// POST /api/portal/set-password — { token, password } (public, token-gated).
// Sets the partner's password from a welcome/reset link and logs them in.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { setPartnerSession } from "@/lib/partners/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }
    throw err;
  }

  const [partner] = await db
    .select()
    .from(partners)
    .where(
      and(
        eq(partners.passwordToken, body.token),
        gt(partners.passwordTokenExpiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!partner) {
    return NextResponse.json(
      { error: "This link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  // Re-check status at the point a session is minted — a token issued at
  // approval must not log in a partner who was since suspended/declined.
  if (!["approved", "active"].includes(partner.status)) {
    return NextResponse.json(
      { error: "This link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(body.password, 10);
  await db
    .update(partners)
    .set({
      passwordHash: hash,
      passwordToken: null,
      passwordTokenExpiresAt: null,
      portalLastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(partners.id, partner.id));

  await setPartnerSession(partner.id);
  return NextResponse.json({ ok: true });
}
