// =============================================================
// Cron: mirror affiliate partners → GoHighLevel B2B subaccount
// =============================================================
// Scheduled daily at 06:00 UTC via vercel.json. Upserts every approved/active
// (non-sample) partner into the B2B GHL subaccount as a tagged contact carrying
// refCode, status, and lifetime paid commission. CRON_SECRET bearer-authed —
// mirrors promote-pending-to-earned. No-op (skipped) until the GHL_B2B_* env
// vars are configured.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { syncAllAffiliates } from "@/lib/integrations/ghl-affiliate-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await syncAllAffiliates();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/sync-ghl-affiliates] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
