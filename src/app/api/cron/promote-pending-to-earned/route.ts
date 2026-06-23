// =============================================================
// Cron: promote pending → earned once the refund window passes
// =============================================================
// Scheduled hourly via vercel.json. Any partner_conversion that is still
// pending and whose refund_window_ends_at has elapsed — refund-free —
// flips to earned (Terms §3.4 / Playbook §17). Mirrors the auth pattern
// of sync-ghl-campaigns.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { promotePendingToEarned } from "@/lib/partners/lifecycle";

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
    const promoted = await promotePendingToEarned(new Date());
    return NextResponse.json({ ok: true, promoted });
  } catch (err) {
    console.error("[cron/promote] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
