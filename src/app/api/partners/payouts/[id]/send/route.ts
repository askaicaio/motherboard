// POST /api/partners/payouts/[id]/send — release this batch NOW via Stripe
// Connect. For every connected affiliate in the batch, transfer their earned
// balance to their connected account and flip those conversions to paid.
//
// This is distinct from /mark-paid: "Mark paid" only records the batch as
// settled in-app (no money moves); "Send payout now" actually pushes the
// Stripe transfers. Affiliates without a connected payout account are skipped
// and stay 'earned' for a later run.
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { releaseBatchViaConnect } from "@/lib/partners/payouts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("admin");
  const { id } = await params;
  try {
    const summary = await releaseBatchViaConnect(id, {
      finalizeBatch: true,
      actor: { actorId: user.id },
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
