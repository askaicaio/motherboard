import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  token: z.string().min(10),
});

/**
 * POST /api/welcome/accept
 * Marks an invite as consumed by clearing the token. Called when the
 * user clicks "Continue with Google" from the welcome page (they're
 * about to sign in via Google OAuth — token is no longer needed).
 */
export async function POST(request: NextRequest) {
  let body;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await db
    .update(adminUsers)
    .set({
      inviteToken: null,
      inviteTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(adminUsers.inviteToken, body.token));

  return NextResponse.json({ success: true });
}
