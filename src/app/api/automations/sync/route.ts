// POST /api/automations/sync — refresh a platform's automations from its
// source (currently Make only). Triggered by the "Refresh List" button.
//
// Body: { platform: string }
// On success returns the freshly-synced rows in the Per Website table's FULL
// row shape (via getPerWebsiteRows, so the client can replace its table without
// losing columns) plus the sync counts. Platforms without a sync yet return
// 400 with a clear message.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import { isSyncablePlatform } from "@/lib/automations/sites";
import { syncMakeAutomations } from "@/lib/integrations/make-sync";
import { syncN8nAutomations } from "@/lib/integrations/n8n-sync";
import { syncGhlAutomations } from "@/lib/integrations/ghl-automations-sync";
// Rows come back through the SHARED loader every other surface uses, so this
// response carries the table's FULL row shape. Do NOT swap this for a local
// query: the client replaces its rows with this payload wholesale, so a short
// one blanks every column it omits (see the helper's header comment).
import { getPerWebsiteRows } from "@/lib/automations/per-website-rows";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({ platform: z.string() });

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const { platform } = body;

  if (!isSyncablePlatform(platform)) {
    return NextResponse.json(
      { error: `Live syncing isn't set up for ${platform} yet.` },
      { status: 400 },
    );
  }

  // Dispatch to the platform's sync engine; add a branch here as each lands.
  try {
    if (platform === "n8n") {
      const result = await syncN8nAutomations(user.id);
      const rows = await getPerWebsiteRows(platform);
      return NextResponse.json({ ok: true, result, rows });
    }
    if (platform === "ghl" || platform === "ghl-b2b") {
      const result = await syncGhlAutomations(platform, user.id);
      const rows = await getPerWebsiteRows(platform);
      return NextResponse.json({ ok: true, result, rows });
    }
    // Default: Make. Error capture is NOT run here — it's a background-only
    // sweep on an 8h timer (see the checker cron). The Refresh button just
    // re-reads what's captured.
    const result = await syncMakeAutomations(user.id);
    const rows = await getPerWebsiteRows(platform);
    return NextResponse.json({ ok: true, result, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${platform} sync] failed:`, message);
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 502 });
  }
}
