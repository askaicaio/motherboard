import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { auth } from "@/lib/auth/options";
import type { SessionUser } from "@/lib/auth/options";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit/logger";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.select().from(appSettings);
  const result: Record<string, unknown> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const body = await request.json();

  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(appSettings)
      .values({ key, value: value as never, updatedBy: user.id, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: value as never, updatedBy: user.id, updatedAt: new Date() },
      });
  }

  await audit({
    action: "settings_updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { keys: Object.keys(body) },
  });

  return NextResponse.json({ success: true });
}
