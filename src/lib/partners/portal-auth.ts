// =============================================================
// Partner portal — password setup / reset helpers
// =============================================================
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/sender";
import { renderBrandedEmail, emailButton } from "@/lib/email/template";
import { sendTemplatedEmail } from "@/lib/email/render";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function portalBaseUrl(): string {
  return (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://affiliates.chiefaiofficer.com"
  ).replace(/\/$/, "");
}

/** Generate + persist a one-time password token for a partner. Returns it. */
export async function issuePasswordToken(partnerId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db
    .update(partners)
    .set({
      passwordToken: token,
      passwordTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      updatedAt: new Date(),
    })
    .where(eq(partners.id, partnerId));
  return token;
}

/** Send the set-password (welcome) or reset email. */
export async function sendPortalPasswordEmail(
  partner: { name: string; email: string },
  token: string,
  kind: "welcome" | "reset",
): Promise<void> {
  const url = `${portalBaseUrl()}/portal/set-password?token=${token}`;

  // The reset path now flows through the editable template system.
  if (kind === "reset") {
    await sendTemplatedEmail("password_reset", partner.email, {
      name: partner.name,
      resetUrl: url,
    });
    return;
  }

  // Welcome (set-password) still uses its inline branded copy.
  const intro =
    "Your CAIO affiliate account is approved. Set a password to access your portal — your referral link, earnings, and payouts.";
  const contentHtml = `
        <p>Hi ${escapeHtml(partner.name)},</p>
        <p>${intro}</p>
        ${emailButton("Set your password →", url)}
        <p style="margin-top:24px;font-size:12px;color:#a1a1aa;line-height:1.6;">This link is valid for 7 days. If you weren't expecting it, you can ignore this email.</p>`;
  const html = renderBrandedEmail({
    heading: "Set up your portal",
    contentHtml,
    preheader: "Set a password to access your affiliate portal.",
  });

  const plain = `Hi ${partner.name},\n\n${intro}\n\n${url}\n\nThis link is valid for 7 days.\n\n— Chief AI Officer Affiliate Program`;

  await sendEmail({ to: partner.email, subject: "Set up your CAIO affiliate portal", html, plain });
}

/** Email a newly-approved affiliate their temporary portal password + login link. */
export async function sendTempPasswordEmail(
  partner: { name: string; email: string },
  tempPassword: string,
): Promise<void> {
  const loginUrl = `${portalBaseUrl()}/portal/login`;
  const subject = "Your CAIO affiliate portal password";
  const intro =
    "Your CAIO affiliate account is approved. Use the temporary password below to sign in to your portal — your referral link, earnings, and payouts.";

  const contentHtml = `
        <p>Hi ${escapeHtml(partner.name)},</p>
        <p>${intro}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Your temporary password:</p>
        <p style="margin:0 0 20px;font-size:20px;font-weight:700;letter-spacing:0.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#1e1b4b;">${escapeHtml(tempPassword)}</p>
        ${emailButton("Sign in to your portal →", loginUrl)}
        <p style="margin-top:24px;font-size:13px;color:#3f3f46;line-height:1.6;">You'll be asked to choose your own password on first sign-in.</p>`;
  const html = renderBrandedEmail({
    heading: "Your portal password",
    contentHtml,
    preheader:
      "Use the temporary password inside to sign in to your affiliate portal.",
  });

  const plain = `Hi ${partner.name},\n\n${intro}\n\nYour temporary password: ${tempPassword}\n\nSign in: ${loginUrl}\n\nYou'll be asked to choose your own password on first sign-in.\n\n— Chief AI Officer Affiliate Program`;

  await sendEmail({ to: partner.email, subject, html, plain });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
