// POST /api/notifications/read-all — mark every live (non-archived) notification
// for the current user as read.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { staffNotifications } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { and, eq } from "drizzle-orm";

export async function POST() {
  const user = await requireAuth();

  await db
    .update(staffNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(staffNotifications.userId, user.id),
        eq(staffNotifications.isRead, false),
        eq(staffNotifications.isArchived, false),
      ),
    );

  return NextResponse.json({ ok: true });
}
