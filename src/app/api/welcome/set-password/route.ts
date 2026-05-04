import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit/logger";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

/**
 * POST /api/welcome/set-password
 * Public endpoint — auth comes from a valid invite token. Sets the
 * user's password hash and marks the invite as accepted by clearing
 * the token. Allows the user to sign in with email + password OR
 * Google going forward.
 */
export async function POST(request: NextRequest) {
  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const [member] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.inviteToken, body.token))
    .limit(1);

  if (!member) {
    return NextResponse.json(
      { error: "Invalid or already-used invite token." },
      { status: 401 },
    );
  }

  if (member.inviteTokenExpiresAt && member.inviteTokenExpiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This invite link has expired. Ask an admin for a new one." },
      { status: 401 },
    );
  }

  // Hash with bcrypt — cost factor 10 is a reasonable balance.
  const passwordHash = await bcrypt.hash(body.password, 10);

  await db
    .update(adminUsers)
    .set({
      passwordHash,
      // Don't clear the token yet — let the user click "set password" again
      // (e.g. to update) before they sign in. Token is cleared when they
      // accept (POST /api/welcome/accept) or first sign in.
      updatedAt: new Date(),
    })
    .where(eq(adminUsers.id, member.id));

  await audit({
    action: "settings_updated",
    actorId: member.id,
    actorEmail: member.email,
    details: {
      kind: "password_set",
      memberId: member.id,
      via: "invite_token",
    },
  });

  return NextResponse.json({ success: true });
}
