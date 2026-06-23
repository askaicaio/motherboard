// GET /api/partners/payouts/[id]/export — finance CSV for ACH/Zelle.
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { buildPayoutCsv } from "@/lib/partners/payouts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");
  const { id } = await params;
  const csv = await buildPayoutCsv(id);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payout-batch-${id.slice(0, 8)}.csv"`,
    },
  });
}
