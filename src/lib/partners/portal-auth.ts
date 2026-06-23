// =============================================================
// Partner portal — password setup / reset helpers
// =============================================================
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/sender";

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
  const subject =
    kind === "welcome"
      ? "Set up your CAIO affiliate portal"
      : "Reset your CAIO affiliate portal password";
  const intro =
    kind === "welcome"
      ? "Your CAIO affiliate account is approved. Set a password to access your portal — your referral link, earnings, and payouts."
      : "We received a request to reset your CAIO affiliate portal password. Use the link below to set a new one.";

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#1e1b4b;padding:22px 32px;color:#fff;font-size:16px;font-weight:600;">Chief AI Officer · Affiliate Program</td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 14px;font-size:20px;">Hi ${escapeHtml(partner.name)},</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3f3f46;">${intro}</p>
        <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:13px 26px;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">${kind === "welcome" ? "Set your password" : "Reset password"} →</a>
        <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.6;">This link is valid for 7 days. If you weren't expecting it, you can ignore this email.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const plain = `Hi ${partner.name},\n\n${intro}\n\n${url}\n\nThis link is valid for 7 days.\n\n— Chief AI Officer Affiliate Program`;

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
