// GET  /api/partner-program/notifications — config: enabled events + subscribers.
// PUT  /api/partner-program/notifications — update the enabled event checklist.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  adminUsers,
  partnerNotificationSettings,
  partnerNotificationSubscribers,
} from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { NOTIFICATION_EVENTS, getEnabledEvents } from "@/lib/notifications/notify";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VALID_KEYS = NOTIFICATION_EVENTS.map((e) => e.key) as [string, ...string[]];

export async function GET() {
  await requireAuth();

  const events = await getEnabledEvents();

  const subscribers = await db
    .select({
      userId: partnerNotificationSubscribers.userId,
      emailEnabled: partnerNotificationSubscribers.emailEnabled,
      name: adminUsers.name,
      email: adminUsers.email,
      avatarUrl: adminUsers.avatarUrl,
    })
    .from(partnerNotificationSubscribers)
    .innerJoin(
      adminUsers,
      eq(adminUsers.id, partnerNotificationSubscribers.userId),
    )
    .orderBy(asc(adminUsers.name));

  return NextResponse.json({
    events,
    allEvents: NOTIFICATION_EVENTS,
    subscribers,
  });
}

const putSchema = z.object({
  events: z.array(z.enum(VALID_KEYS)),
});

export async function PUT(request: NextRequest) {
  await requireRole("admin");

  let events: string[];
  try {
    ({ events } = putSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Upsert the single settings row.
  await db
    .insert(partnerNotificationSettings)
    .values({ id: "default", events, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: partnerNotificationSettings.id,
      set: { events, updatedAt: new Date() },
    });

  return NextResponse.json({ events });
}
