// DELETE /api/partner-program/notifications/subscribers/[userId] — unsubscribe.
// PATCH  .../[userId] — toggle a subscriber's email opt-in. body: { emailEnabled }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerNotificationSubscribers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  await requireRole("admin");
  const { userId } = await params;

  await db
    .delete(partnerNotificationSubscribers)
    .where(eq(partnerNotificationSubscribers.userId, userId));

  return NextResponse.json({ ok: true });
}

const patchSchema = z.object({ emailEnabled: z.boolean() });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  await requireRole("admin");
  const { userId } = await params;

  let emailEnabled: boolean;
  try {
    ({ emailEnabled } = patchSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [updated] = await db
    .update(partnerNotificationSubscribers)
    .set({ emailEnabled })
    .where(eq(partnerNotificationSubscribers.userId, userId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ subscriber: updated });
}
