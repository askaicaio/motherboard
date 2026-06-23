// POST /api/partners/payouts/[id]/mark-paid — flip every earned conversion
// in the batch to paid and stamp the batch.
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { markBatchPaid } from "@/lib/partners/lifecycle";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("admin");
  const { id } = await params;
  const flipped = await markBatchPaid(id, {
    actorId: user.id,
    actorEmail: user.email ?? null,
  });
  return NextResponse.json({ ok: true, conversionsPaid: flipped });
}
