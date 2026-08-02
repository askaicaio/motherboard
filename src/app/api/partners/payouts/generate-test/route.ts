// POST /api/partners/payouts/generate-test — TEST-ONLY. Create a draft batch
// that BYPASSES the Net-45 maturity hold and the minimum-payout floor, so a real
// Stripe Connect transfer can be exercised end-to-end without waiting or editing
// settings. Stripe Connect "ready" is still required. The real cron + the normal
// "Generate payout batch" never bypass, so production keeps Net-45 + the floor.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { generatePayoutBatch } from "@/lib/partners/payouts";

export const dynamic = "force-dynamic";

const schema = z.object({
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
    const result = await generatePayoutBatch(period, user.id, {
      bypassGates: true,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 422 },
    );
  }
}
