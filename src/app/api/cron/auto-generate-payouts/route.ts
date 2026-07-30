// =============================================================
// Cron: auto-generate partner payout batches (Net-45)
// =============================================================
// Scheduled DAILY via vercel.json (08:00 UTC). Commissions pay on Net-45
// terms — a commission is only PAYABLE 45 days after the close of the
// calendar-month period in which it was earned. That maturity gate lives in
// previewPayout(), so this cron simply runs every day and pays whatever has
// matured (plus the $100 minimum + connected-Stripe gates). On a day with
// nothing matured/eligible, generatePayoutBatch throws "No partners are
// eligible" which we treat as a no-op. It does NOT mark anything paid beyond
// the automatic Connect transfers. Mirrors the auth pattern of
// promote-pending-to-earned.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  generatePayoutBatch,
  releaseBatchViaConnect,
} from "@/lib/partners/payouts";

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
    const now = new Date();

    // Label the batch with the current period; maturity (Net-45) is enforced
    // inside previewPayout, so this runs daily and pays what's ready.
    const period = now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
    const result = await generatePayoutBatch(period, null);

    // Auto-pay Connect-ready affiliates in the freshly generated batch. Wrapped
    // so a Stripe outage (or Connect not yet enabled) never fails the cron —
    // non-connected affiliates remain 'earned' for the manual ACH export.
    // finalizeBatch stamps the batch 'paid' once no 'earned' rows remain, so a
    // fully auto-settled batch doesn't linger as an actionable 'draft' (which
    // finance could otherwise export + pay a second time).
    let connect = null;
    try {
      connect = await releaseBatchViaConnect(result.batchId, {
        finalizeBatch: true,
      });
    } catch (err) {
      console.error(
        "[cron/auto-generate-payouts] connect release failed:",
        err,
      );
    }

    return NextResponse.json({ ok: true, ...result, connect });
  } catch (err) {
    // "No partners are eligible" is an expected no-op outcome, not a failure.
    const message = err instanceof Error ? err.message : "failed";
    if (/no partners are eligible/i.test(message)) {
      return NextResponse.json({ ok: true, skipped: true, reason: message });
    }
    console.error("[cron/auto-generate-payouts] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
