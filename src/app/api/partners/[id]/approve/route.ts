// POST /api/partners/[id]/approve — approve a partner (admin).
// Sets status='active', stamps approvedAt/approvedBy, ensures a refCode,
// then emails the partner their referral link.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { generateRefCode } from "@/lib/partners/rules";
import { issuePasswordToken } from "@/lib/partners/portal-auth";
import { sendEmail } from "@/lib/email/sender";
import { eq } from "drizzle-orm";

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
          .set({
            status: "active",
            refCode: generateRefCode(),
            approvedAt: now,
            approvedBy: user.id,
            updatedAt: now,
          })
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
      .set({
        status: "active",
        approvedAt: now,
        approvedBy: user.id,
        updatedAt: now,
      })
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

  // Issue a one-time token so the partner can set their portal password.
  let portalUrl: string | null = null;
  try {
    const token = await issuePasswordToken(updated.id);
    portalUrl = `${base}/portal/set-password?token=${token}`;
  } catch (err) {
    console.error("[approve] portal token failed:", err);
  }

  const portalBlockHtml = portalUrl
    ? `<p>Set up your affiliate portal to track your clicks, conversions, and payouts:</p>
       <p><a href="${portalUrl}">Set your portal password →</a></p>`
    : "";

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
    ...(portalUrl
      ? ["", "Set up your affiliate portal to track clicks, conversions, and payouts:", portalUrl]
      : []),
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
