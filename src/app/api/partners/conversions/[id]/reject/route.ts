// POST /api/partners/conversions/[id]/reject
// Admin: reject a conversion with an internal + optional public reason.
// Logs an event.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerConversions, partnerConversionEvents } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const schema = z.object({
  rejectReason: z.string().min(1).max(2000),
  publicRejectReason: z.string().max(2000).nullable().optional(),
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

  const [updated] = await db
    .update(partnerConversions)
    .set({
      status: "rejected",
      rejectReason: body.rejectReason,
      publicRejectReason: body.publicRejectReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(partnerConversions.id, id))
    .returning();

  await db.insert(partnerConversionEvents).values({
    conversionId: id,
    eventType: "manually_rejected",
    fromStatus: existing.status,
    toStatus: "rejected",
    actorId: user.id,
    actorEmail: user.email ?? null,
    details: {
      rejectReason: body.rejectReason,
      publicRejectReason: body.publicRejectReason ?? null,
    },
  });

  return NextResponse.json({ ok: true, conversion: updated });
}
