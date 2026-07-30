// PATCH /api/notifications/[id] — mutate one of the current user's notifications.
// body: { action: "read" | "unread" | "archive" | "unarchive" }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { staffNotifications } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { and, eq } from "drizzle-orm";

const bodySchema = z.object({
  action: z.enum(["read", "unread", "archive", "unarchive"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  const { id } = await params;

  let action: z.infer<typeof bodySchema>["action"];
  try {
    ({ action } = bodySchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const now = new Date();
  const patch =
    action === "read"
      ? { isRead: true, readAt: now }
      : action === "unread"
        ? { isRead: false, readAt: null }
        : action === "archive"
          ? { isArchived: true, archivedAt: now }
          : { isArchived: false, archivedAt: null };

  const [updated] = await db
    .update(staffNotifications)
    .set(patch)
    // Scope to the caller — you can only touch your own notifications.
    .where(
      and(
        eq(staffNotifications.id, id),
        eq(staffNotifications.userId, user.id),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ notification: updated });
}
