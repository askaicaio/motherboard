// POST /api/partners/[id]/approve — approve a partner (admin).
// Sets status='active', stamps approvedAt/approvedBy, ensures a refCode,
// then emails the partner their referral link.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { generateRefCode } from "@/lib/partners/rules";
import { sendEmail } from "@/lib/email/sender";
import { eq } from "drizzle-orm";

/** Readable, URL-safe temporary password, e.g. "Caio-a1B2c3D4". */
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
  const user = await requireRole("admin");

  const { id } = await params;
  const [existing] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  // Generate a temporary password the affiliate uses for their first sign-in.
  // They're forced to choose their own on first portal login.
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // Fields applied on approval, regardless of refCode path.
  const approvalFields = {
    status: "active" as const,
    approvedAt: now,
    approvedBy: user.id,
    passwordHash,
    mustChangePassword: true,
    // Clear any pending set-password token — temp-password flow supersedes it.
    passwordToken: null,
    passwordTokenExpiresAt: null,
    updatedAt: now,
  };

  // Ensure a refCode exists. It's usually generated at creation, but if it's
  // somehow empty, generate one and retry up to 5x on unique-violation.
  let updated = existing;
  if (!existing.refCode) {
    let saved;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        [saved] = await db
          .update(partners)
          .set({ ...approvalFields, refCode: generateRefCode() })
          .where(eq(partners.id, id))
          .returning();
        break;
      } catch (err) {
        lastErr = err;
        const code = (err as { code?: string }).code;
        if (code === "23505" && /ref_code/.test(String(err))) continue;
        throw err;
      }
    }
    if (!saved) throw lastErr ?? new Error("Failed to assign ref code");
    updated = saved;
  } else {
    const [saved] = await db
      .update(partners)
      .set(approvalFields)
      .where(eq(partners.id, id))
      .returning();
    updated = saved;
  }

  // Build the referral link from env.
  const base = (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://chiefaiofficer.com"
  ).replace(/\/$/, "");
  const link = `${base}/r?aff=${updated.refCode}`;
  const loginUrl = `${base}/portal/login`;

  const portalBlockHtml = `
    <p>Sign in to your affiliate portal to track your clicks, conversions, and payouts.</p>
    <p>Your temporary password is: <strong>${tempPassword}</strong></p>
    <p><a href="${loginUrl}">Sign in to your portal →</a></p>
    <p>You'll be asked to choose your own password on first sign-in.</p>`;

  const html = `
    <p>Hi ${updated.name},</p>
    <p>Great news — your application to the CAIO Affiliate Program has been approved!</p>
    <p>Your personal referral link is:</p>
    <p><a href="${link}">${link}</a></p>
    <p>Share it with anyone who could benefit from working with a Chief AI Officer.
    When they engage through your link, you'll earn commission on qualifying sales.</p>
    ${portalBlockHtml}
    <p>Welcome aboard,<br/>The CAIO Team</p>
  `.trim();

  const plain = [
    `Hi ${updated.name},`,
    "",
    "Great news — your application to the CAIO Affiliate Program has been approved!",
    "",
    "Your personal referral link is:",
    link,
    "",
    "Share it with anyone who could benefit from working with a Chief AI Officer. " +
      "When they engage through your link, you'll earn commission on qualifying sales.",
    "",
    "Sign in to your affiliate portal to track clicks, conversions, and payouts.",
    `Your temporary password is: ${tempPassword}`,
    loginUrl,
    "You'll be asked to choose your own password on first sign-in.",
    "",
    "Welcome aboard,",
    "The CAIO Team",
  ].join("\n");

  await sendEmail({
    to: updated.email,
    subject: "You're approved for the CAIO Affiliate Program",
    html,
    plain,
  });

  return NextResponse.json({ partner: updated });
}
