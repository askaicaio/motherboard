// POST /api/portal/forgot — { email } (public). Emails a reset link if the
// partner exists. Always returns ok so it can't be used to probe accounts.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { issuePasswordToken, sendPortalPasswordEmail } from "@/lib/partners/portal-auth";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email().toLowerCase() });

export async function POST(request: NextRequest) {
  let body;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: true }); // uniform response
  }

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.email, body.email))
    .limit(1);

  if (partner && ["approved", "active"].includes(partner.status)) {
    try {
      const token = await issuePasswordToken(partner.id);
      await sendPortalPasswordEmail(partner, token, "reset");
    } catch (err) {
      console.error("[portal/forgot] email failed:", err);
    }
  }

  // Always uniform — never reveal whether the email is registered.
  return NextResponse.json({ ok: true });
}
