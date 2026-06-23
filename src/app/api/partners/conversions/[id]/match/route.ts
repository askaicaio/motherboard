// POST /api/partners/conversions/[id]/match
// Admin: bind a conversion to a partner. If it was rejected as unmatched,
// move it back to pending and clear the reject reasons. Logs an event.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerConversions, partnerConversionEvents } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const schema = z.object({
  partnerId: z.string().uuid(),
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

  const wasRejected = existing.status === "rejected";

  const patch: Record<string, unknown> = {
    partnerId: body.partnerId,
    updatedAt: new Date(),
  };
  if (wasRejected) {
    patch.status = "pending";
    patch.rejectReason = null;
    patch.publicRejectReason = null;
  }

  const [updated] = await db
    .update(partnerConversions)
    .set(patch)
    .where(eq(partnerConversions.id, id))
    .returning();

  await db.insert(partnerConversionEvents).values({
    conversionId: id,
    eventType: "manually_matched",
    fromStatus: existing.status,
    toStatus: wasRejected ? "pending" : existing.status,
    actorId: user.id,
    actorEmail: user.email ?? null,
    details: { partnerId: body.partnerId },
  });

  return NextResponse.json({ ok: true, conversion: updated });
}
