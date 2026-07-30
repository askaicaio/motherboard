// POST /api/partner-program/notifications/subscribers — add a subscriber.
// body: { userId: string }  (email opt-in defaults to off)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  adminUsers,
  partnerNotificationSubscribers,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

const bodySchema = z.object({ userId: z.string().uuid() });

export async function POST(request: NextRequest) {
  await requireRole("admin");

  let userId: string;
  try {
    ({ userId } = bodySchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Confirm the target is a real staff member.
  const [member] = await db
    .select({
      id: adminUsers.id,
      name: adminUsers.name,
      email: adminUsers.email,
      avatarUrl: adminUsers.avatarUrl,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1);
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await db
    .insert(partnerNotificationSubscribers)
    .values({ userId, emailEnabled: false })
    .onConflictDoNothing();

  return NextResponse.json({
    subscriber: { ...member, userId: member.id, emailEnabled: false },
  });
}
