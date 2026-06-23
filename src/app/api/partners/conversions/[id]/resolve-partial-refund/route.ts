// POST /api/partners/conversions/[id]/resolve-partial-refund
// Admin: clears the promotion hold on a conversion flagged for partial
// refund review. Optionally overrides the commission amount. Logs an event.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerConversions, partnerConversionEvents } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const schema = z.object({
  adjustedCommissionCents: z.number().int().nonnegative().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireRole("admin");
  const { id } = await params;

  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const [existing] = await db
    .select()
    .from(partnerConversions)
    .where(eq(partnerConversions.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.adjustedCommissionCents !== undefined) {
    patch.commissionCents = body.adjustedCommissionCents;
  }

  const [updated] = await db
    .update(partnerConversions)
    .set(patch)
    .where(eq(partnerConversions.id, id))
    .returning();

  await db.insert(partnerConversionEvents).values({
    conversionId: id,
    eventType: "partial_refund_resolved",
    fromStatus: existing.status,
    toStatus: existing.status,
    actorId: user.id,
    actorEmail: user.email ?? null,
    details: {
      adjustedCommissionCents: body.adjustedCommissionCents ?? null,
    },
  });

  return NextResponse.json({ ok: true, conversion: updated });
}
