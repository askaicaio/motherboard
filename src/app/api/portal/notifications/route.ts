// GET /api/portal/notifications — the logged-in AFFILIATE's in-app notifications.
// ?view=archived returns the archive; default returns the live inbox. Always
// returns the unread count (live, non-archived) for the portal bell badge.
// Gated by the partner cookie (getPartnerSession) — never the staff auth.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partnerNotifications } from "@/lib/db/schema";
import { getPartnerSession } from "@/lib/partners/session";
import { and, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const archived = request.nextUrl.searchParams.get("view") === "archived";

  const notifications = await db
    .select()
    .from(partnerNotifications)
    .where(
      and(
        eq(partnerNotifications.partnerId, partner.id),
        eq(partnerNotifications.isArchived, archived),
      ),
    )
    .orderBy(desc(partnerNotifications.createdAt))
    .limit(50);

  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(partnerNotifications)
    .where(
      and(
        eq(partnerNotifications.partnerId, partner.id),
        eq(partnerNotifications.isRead, false),
        eq(partnerNotifications.isArchived, false),
      ),
    );

  return NextResponse.json({ notifications, unreadCount: unread });
}
