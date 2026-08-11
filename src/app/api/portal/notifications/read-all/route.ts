// POST /api/portal/notifications/read-all — mark every live (non-archived)
// notification for the logged-in affiliate as read. Skipped during an admin
// "View as" preview so it can't clear the real affiliate's unread badge.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partnerNotifications } from "@/lib/db/schema";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";
import { and, eq } from "drizzle-orm";

export async function POST() {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await getImpersonation()) {
    return NextResponse.json({ ok: true, impersonating: true });
  }

  await db
    .update(partnerNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(partnerNotifications.partnerId, partner.id),
        eq(partnerNotifications.isRead, false),
        eq(partnerNotifications.isArchived, false),
      ),
    );

  return NextResponse.json({ ok: true });
}
