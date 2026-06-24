// =============================================================
// Cron: auto-generate the monthly partner payout batch
// =============================================================
// Scheduled DAILY via vercel.json (08:00 UTC). Each run checks the active
// settings' payoutDayOfMonth and only generates a batch when today's UTC
// day-of-month matches — otherwise it's a no-op. Generates a DRAFT payout
// batch for the current period using the SAME logic as the manual
// /api/partners/payouts/generate endpoint (generatePayoutBatch). It does
// NOT mark anything paid — releasing money stays a manual admin click.
// Mirrors the auth pattern of promote-pending-to-earned.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  generatePayoutBatch,
  releaseBatchViaConnect,
} from "@/lib/partners/payouts";
import { getActiveSettings } from "@/lib/partners/queries";

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

    // Only run on the configured payout day. The cron fires daily, so every
    // other day is a deliberate no-op. Default to the 1st if no settings yet.
    const settings = await getActiveSettings(now);
    const payoutDay = settings?.payoutDayOfMonth ?? 1;
    if (now.getUTCDate() !== payoutDay) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "not payout day",
      });
    }

    const period = now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
    const result = await generatePayoutBatch(period, null);

    // Auto-pay Connect-ready affiliates in the freshly generated batch. Wrapped
    // so a Stripe outage (or Connect not yet enabled) never fails the cron —
    // non-connected affiliates remain 'earned' for the manual ACH export.
    let connect = null;
    try {
      connect = await releaseBatchViaConnect(result.batchId);
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
