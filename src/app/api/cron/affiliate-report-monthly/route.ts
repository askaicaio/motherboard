// =============================================================
// Cron: monthly affiliate-program report to the internal team
// =============================================================
// Scheduled for the 1st of each month (vercel.json). Aggregates the PREVIOUS
// full calendar month (UTC) — applications, approvals, conversions, commissions
// cleared, payouts, plus standing totals and top affiliates — and emails the
// internal team. Vercel crons can't pass query params, so a weekly variant would
// be a separate route; this one is monthly per the team's choice.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { buildAffiliateReport } from "@/lib/partners/report";
import { sendAffiliateReportEmail } from "@/lib/partners/report-email";

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
    // Previous full calendar month: [first-of-last-month, first-of-this-month) in UTC.
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );

    const stats = await buildAffiliateReport(start, end);
    await sendAffiliateReportEmail(stats, { start, end, cadence: "monthly" });

    return NextResponse.json({ ok: true, start, end, ...stats });
  } catch (err) {
    console.error("[cron/affiliate-report-monthly] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
