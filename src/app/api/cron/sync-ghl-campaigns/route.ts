// =============================================================
// Cron job: sync all active campaigns that have a GHL tag
// =============================================================
// Scheduled via vercel.json — runs every 5 minutes. Skips archived
// campaigns and any without a ghl_tag set. Errors on one campaign
// don't abort the rest.
//
// Vercel sets a CRON_SECRET environment variable and passes it via
// the Authorization header on cron invocations. We reject any other
// caller to prevent abuse.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { and, isNull, isNotNull, ne } from "drizzle-orm";
import { syncCampaignFromGhl } from "@/lib/integrations/ghl-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // No secret configured = anyone can run it. Allow in dev only.
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await db
    .select({ id: campaigns.id, name: campaigns.name, ghlTag: campaigns.ghlTag })
    .from(campaigns)
    .where(
      and(
        isNull(campaigns.archivedAt),
        isNotNull(campaigns.ghlTag),
        ne(campaigns.status, "archived"),
      ),
    );

  const results = [];
  for (const c of candidates) {
    try {
      const r = await syncCampaignFromGhl(c.id);
      results.push({ campaign: c.name, ...r });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ campaign: c.name, campaignId: c.id, ok: false, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    syncedCampaigns: candidates.length,
    results,
  });
}
