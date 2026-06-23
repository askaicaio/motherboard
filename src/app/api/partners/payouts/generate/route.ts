// POST /api/partners/payouts/generate — create a draft batch from the
// current eligible (earned, over-threshold, tax-valid) balances.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { generatePayoutBatch } from "@/lib/partners/payouts";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** YYYYMM. Defaults to the current month. */
  periodYyyymm: z.number().int().min(202000).max(210012).optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireRole("admin");

  let body: z.infer<typeof schema> = {};
  try {
    body = schema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const now = new Date();
  const period =
    body.periodYyyymm ?? now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1);

  try {
    const result = await generatePayoutBatch(period, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 422 },
    );
  }
}
