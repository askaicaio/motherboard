// POST /api/partners/conversions/[id]/mark-earned
// Admin: skip the refund window for a PENDING conversion and mark it earned.
// Mainly for testing payouts. Logs a status_changed event.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partnerConversions, partnerConversionEvents } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole("admin");
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(partnerConversions)
      .where(eq(partnerConversions.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending conversions can be marked earned." },
        { status: 422 },
      );
    }

    const now = new Date();

    const [updated] = await db
      .update(partnerConversions)
      .set({
        status: "earned",
        earnedAt: now,
        updatedAt: now,
      })
      .where(eq(partnerConversions.id, id))
      .returning();

    await db.insert(partnerConversionEvents).values({
      conversionId: id,
      eventType: "status_changed",
      fromStatus: "pending",
      toStatus: "earned",
      actorId: user.id,
      actorEmail: user.email ?? null,
      details: { via: "admin_mark_earned" },
    });

    return NextResponse.json({ conversion: updated });
  } catch (err) {
    console.error("mark-earned failed", err);
    return NextResponse.json(
      { error: "Failed to mark conversion earned." },
      { status: 500 },
    );
  }
}
