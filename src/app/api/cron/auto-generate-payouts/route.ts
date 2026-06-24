// =============================================================
// Cron: auto-generate the monthly partner payout batch
// =============================================================
// Scheduled monthly via vercel.json (1st @ 08:00 UTC). Generates a DRAFT
// payout batch for the current period using the SAME logic as the manual
// /api/partners/payouts/generate endpoint (generatePayoutBatch). It does
// NOT mark anything paid — releasing money stays a manual admin click.
// Mirrors the auth pattern of promote-pending-to-earned.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { generatePayoutBatch } from "@/lib/partners/payouts";

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
    const period = now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);
    const result = await generatePayoutBatch(period, null);
    return NextResponse.json({ ok: true, ...result });
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
