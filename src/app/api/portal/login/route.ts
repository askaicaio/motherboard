// POST /api/portal/login — partner email + password sign-in (public).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setPartnerSession } from "@/lib/partners/session";

export const dynamic = "force-dynamic";

// A valid bcrypt hash to compare against when the account doesn't exist, so the
// response time is constant whether or not the email is registered (defeats the
// account-enumeration timing oracle). Computed once at module load.
const DUMMY_HASH = bcrypt.hashSync("caio-portal-timing-guard", 10);

const schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.email, body.email))
    .limit(1);

  // Uniform error — don't reveal whether the email exists.
  const invalid = NextResponse.json(
    { error: "Invalid email or password." },
    { status: 401 },
  );

  // Always run a bcrypt compare (against a dummy hash when the account/hash is
  // absent) so timing can't be used to enumerate registered accounts.
  const ok = await bcrypt.compare(
    body.password,
    partner?.passwordHash || DUMMY_HASH,
  );
  if (!partner || !partner.passwordHash || !ok) return invalid;

  // Only after the password is proven correct do we reveal an inactive status —
  // so this 403 never leaks account existence to someone who doesn't own it.
  if (!["approved", "active"].includes(partner.status)) {
    return NextResponse.json(
      { error: "Your affiliate account isn't active. Contact partners@chiefaiofficer.com." },
      { status: 403 },
    );
  }

  await db
    .update(partners)
    .set({ portalLastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(partners.id, partner.id));

  await setPartnerSession(partner.id);
  return NextResponse.json({ ok: true });
}
