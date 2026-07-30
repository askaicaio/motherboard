// GET /api/notifications — the current staff member's in-app notifications.
// ?view=archived returns the archive; default returns the live inbox. Always
// returns the unread count (live, non-archived) for the bell badge.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { staffNotifications } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { and, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireAuth();
  const archived =
    request.nextUrl.searchParams.get("view") === "archived";

  const notifications = await db
    .select()
    .from(staffNotifications)
    .where(
      and(
        eq(staffNotifications.userId, user.id),
        eq(staffNotifications.isArchived, archived),
      ),
    )
    .orderBy(desc(staffNotifications.createdAt))
    .limit(50);

  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(staffNotifications)
    .where(
      and(
        eq(staffNotifications.userId, user.id),
        eq(staffNotifications.isRead, false),
        eq(staffNotifications.isArchived, false),
      ),
    );

  return NextResponse.json({ notifications, unreadCount: unread });
}
