// PATCH /api/portal/notifications/[id] — mutate one of the affiliate's
// notifications. body: { action: "read" | "unread" | "archive" | "unarchive" }.
// Scoped to the caller by partnerId; an admin "View as" preview never mutates
// the real affiliate's state.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerNotifications } from "@/lib/db/schema";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";
import { and, eq } from "drizzle-orm";

const bodySchema = z.object({
  action: z.enum(["read", "unread", "archive", "unarchive"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let action: z.infer<typeof bodySchema>["action"];
  try {
    ({ action } = bodySchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // An admin "View as" preview must never clear the real affiliate's unread
  // badge — accept the request but skip the mutation.
  if (await getImpersonation()) {
    return NextResponse.json({ ok: true, impersonating: true });
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
    .update(partnerNotifications)
    .set(patch)
    .where(
      and(
        eq(partnerNotifications.id, id),
        eq(partnerNotifications.partnerId, partner.id),
      ),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ notification: updated });
}
