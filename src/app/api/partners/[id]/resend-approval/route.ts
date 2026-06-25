// POST /api/partners/[id]/resend-approval — re-send an active affiliate their
// welcome email with a FRESH temporary password (the old one isn't recoverable
// since only the hash is stored). Admin only.
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { sendEmail } from "@/lib/email/sender";
import { renderBrandedEmail } from "@/lib/email/template";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function generateTempPassword(): string {
  const suffix = randomBytes(8)
    .toString("base64url")
    .replace(/[-_]/g, "")
    .slice(0, 8)
    .padEnd(8, "0");
  return `Caio-${suffix}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");
  const { id } = await params;

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, id))
    .limit(1);

  if (!partner) {
    return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  }
  if (!["approved", "active"].includes(partner.status)) {
    return NextResponse.json(
      { error: "Only approved/active affiliates can be re-sent their welcome." },
      { status: 422 },
    );
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const [updated] = await db
    .update(partners)
    .set({
      passwordHash,
      mustChangePassword: true,
      passwordToken: null,
      passwordTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(partners.id, id))
    .returning();

  const base = (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://affiliates.chiefaiofficer.com"
  ).replace(/\/$/, "");
  const link = `${base}/r?aff=${updated.refCode}`;
  const loginUrl = `${base}/portal/login`;

  const contentHtml = `
    <p>Hi ${updated.name},</p>
    <p>Here are your Chief AI Officer affiliate portal details again.</p>
    <p>Your personal referral link is:</p>
    <p><a href="${link}">${link}</a></p>
    <p>Sign in to track your clicks, conversions, and payouts.</p>
    <p>Your new temporary password is: <strong>${tempPassword}</strong></p>
    <p><a href="${loginUrl}">Sign in to your portal →</a></p>
    <p>You'll be asked to choose your own password on first sign-in.</p>
    <p>Welcome aboard,<br/>The CAIO Team</p>
  `.trim();

  const html = renderBrandedEmail({
    heading: "Your affiliate portal details",
    contentHtml,
    preheader: "Your referral link and a fresh temporary password are inside.",
  });

  const plain = [
    `Hi ${updated.name},`,
    "",
    "Here are your Chief AI Officer affiliate portal details again.",
    "",
    `Referral link: ${link}`,
    "",
    "Sign in to track your clicks, conversions, and payouts.",
    `Your new temporary password is: ${tempPassword}`,
    loginUrl,
    "You'll be asked to choose your own password on first sign-in.",
    "",
    "Welcome aboard,",
    "The CAIO Team",
  ].join("\n");

  try {
    await sendEmail({
      to: updated.email,
      subject: "Your CAIO Affiliate Program portal details",
      html,
      plain,
    });
  } catch (err) {
    console.error("[resend-approval] email failed:", err);
    return NextResponse.json(
      { error: "Could not send the email. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
