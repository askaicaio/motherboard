// =============================================================
// Email template registry — a single source of truth describing EVERY system
// email the affiliate platform sends. Each descriptor knows when/why it fires,
// who receives it, and can render a representative preview (subject + branded
// HTML) so staff can audit the live design without digging through code.
//
// NOTE: render() builds the email exactly the way the real trigger does — it
// wraps representative SAMPLE data in renderBrandedEmail() so the preview
// reflects what an affiliate/admin actually receives.
// =============================================================

import { renderBrandedEmail, emailButton } from "./template";

export type EmailRecipient = "Affiliate" | "Admin";

export interface EmailTemplateDescriptor {
  /** Stable identifier (used as a React key / anchor). */
  key: string;
  /** Human-friendly name. */
  name: string;
  /** Plain-English description of when/why this email fires. */
  trigger: string;
  /** Who receives it. */
  recipient: EmailRecipient;
  /** Builds the previewable email (subject + branded HTML) with sample data. */
  render: () => { subject: string; html: string };
}

// Sample values reused across previews so they read like a real email.
const SAMPLE_NAME = "Jordan Avery";
const SAMPLE_FIRST = "Jordan";
const SAMPLE_EMAIL = "jordan.avery@example.com";
const SAMPLE_REF = "JORDANA1";
const SAMPLE_BASE = "https://affiliates.chiefaiofficer.com";
const SAMPLE_LINK = `${SAMPLE_BASE}/r?aff=${SAMPLE_REF}`;
const SAMPLE_LOGIN = `${SAMPLE_BASE}/portal/login`;
const SAMPLE_RESET = `${SAMPLE_BASE}/portal/set-password?token=sample-token-7f3a9c`;
const SAMPLE_DISPUTES = `${SAMPLE_BASE}/portal/disputes`;
const SAMPLE_TEMP_PW = "Caio-a1B2c3D4";

export const EMAIL_TEMPLATES: EmailTemplateDescriptor[] = [
  // ── (a) Application received — to the applicant ──────────────────────────
  {
    key: "application-received",
    name: "Application received",
    trigger:
      "Fires the moment a prospective affiliate submits the public application form. Confirms we got it and sets expectations for review.",
    recipient: "Affiliate",
    render() {
      const contentHtml = `
        <p>Hi ${SAMPLE_FIRST},</p>
        <p>Thank you for applying to the Chief AI Officer Affiliate Program! We review every application personally and will be in touch within 3 business days.</p>
        <p>Here's a quick recap of what to expect:</p>
        <ul>
          <li><strong>10% flat commission</strong> on every closed deal you refer</li>
          <li><strong>60-day cookie window</strong> from first click</li>
          <li><strong>Net-45 payouts</strong> via ACH or Zelle (W-9 / W-8BEN required)</li>
        </ul>
        <p>If you have any questions in the meantime, feel free to reply to this email.</p>
        <p>— The Chief AI Officer Team</p>`;
      return {
        subject: "We received your Chief AI Officer affiliate application",
        html: renderBrandedEmail({
          heading: "We received your application",
          contentHtml,
          preheader: "We review every application personally — expect to hear back within 3 business days.",
        }),
      };
    },
  },

  // ── (b) New application — to the admin inbox (partners@) ──────────────────
  {
    key: "new-application-admin",
    name: "New application (admin notification)",
    trigger:
      "Fires alongside the applicant confirmation whenever the public application form is submitted. Sent to partners@chiefaiofficer.com so staff can review.",
    recipient: "Admin",
    render() {
      const taxLink = `${SAMPLE_BASE}/api/partners/sample-id/tax-form`;
      const reviewLink = "https://chiefaiofficer.com/partner-program/applications";
      const contentHtml = `
        <p>A new affiliate application was submitted.</p>
        <table style="border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${SAMPLE_NAME}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>${SAMPLE_EMAIL}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Location</td><td>Austin, TX, United States</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Heard via</td><td>LinkedIn</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Audience size</td><td>24500</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Tax form</td><td><a href="${taxLink}">W-9_jordan_avery.pdf</a></td></tr>
        </table>
        ${emailButton("Review in Motherboard →", reviewLink)}`;
      return {
        subject: `New affiliate application: ${SAMPLE_NAME}`,
        html: renderBrandedEmail({
          heading: "New affiliate application",
          contentHtml,
          preheader: `${SAMPLE_NAME} just applied to the affiliate program.`,
        }),
      };
    },
  },

  // ── (c) Approved — temp password — to the affiliate ──────────────────────
  {
    key: "approved-temp-password",
    name: "Approved — temporary password",
    trigger:
      "Fires when an admin approves a pending application. Delivers the affiliate's referral link, a temporary portal password, and the login link.",
    recipient: "Affiliate",
    render() {
      const contentHtml = `
        <p>Hi ${SAMPLE_NAME},</p>
        <p>Great news — your application to the CAIO Affiliate Program has been approved!</p>
        <p>Your personal referral link is:</p>
        <p><a href="${SAMPLE_LINK}">${SAMPLE_LINK}</a></p>
        <p>Share it with anyone who could benefit from working with a Chief AI Officer.
        When they engage through your link, you'll earn commission on qualifying sales.</p>
        <p>Sign in to your affiliate portal to track your clicks, conversions, and payouts.</p>
        <p>Your temporary password is: <strong>${SAMPLE_TEMP_PW}</strong></p>
        ${emailButton("Sign in to your portal →", SAMPLE_LOGIN)}
        <p>You'll be asked to choose your own password on first sign-in.</p>
        <p>Welcome aboard,<br/>The CAIO Team</p>`;
      return {
        subject: "You're approved for the CAIO Affiliate Program",
        html: renderBrandedEmail({
          heading: "You're approved!",
          contentHtml,
          preheader: "Your referral link and temporary portal password are inside.",
        }),
      };
    },
  },

  // ── (d) Password reset link — to the affiliate ───────────────────────────
  {
    key: "password-reset",
    name: "Password reset link",
    trigger:
      "Fires when an affiliate requests a password reset (or when a welcome/set-password link is issued). Contains a one-time link valid for 7 days.",
    recipient: "Affiliate",
    render() {
      const intro =
        "We received a request to reset your CAIO affiliate portal password. Use the button below to set a new one.";
      const contentHtml = `
        <p>Hi ${SAMPLE_NAME},</p>
        <p>${intro}</p>
        ${emailButton("Reset password →", SAMPLE_RESET)}
        <p style="margin-top:24px;font-size:13px;color:#71717a;">This link is valid for 7 days. If you weren't expecting it, you can safely ignore this email.</p>`;
      return {
        subject: "Reset your CAIO affiliate portal password",
        html: renderBrandedEmail({
          heading: "Reset your password",
          contentHtml,
          preheader: "Set a new password — this link is valid for 7 days.",
        }),
      };
    },
  },

  // ── (e) Dispute decision — upheld ────────────────────────────────────────
  {
    key: "dispute-upheld",
    name: "Dispute decision — approved",
    trigger:
      "Fires when an admin upholds (approves) an affiliate-submitted conversion dispute. Tells the affiliate we'll credit the referral.",
    recipient: "Affiliate",
    render() {
      const resolutionBlock = `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;"><strong>Note from our team:</strong><br/>We matched the order to your click within the cookie window — the commission is now on its way.</p>`;
      const contentHtml = `
        <p>Hi ${SAMPLE_FIRST},</p>
        <p>Good news — we reviewed your dispute and approved it. We'll credit the referral to your account.</p>
        ${resolutionBlock}
        ${emailButton("View your disputes", SAMPLE_DISPUTES)}
        <p style="font-size:13px;color:#64748b;">— The Chief AI Officer Affiliate Team</p>`;
      return {
        subject: "Your referral dispute was approved",
        html: renderBrandedEmail({
          heading: "Your dispute was approved",
          contentHtml,
          preheader: "We reviewed your dispute and will credit the referral.",
        }),
      };
    },
  },

  // ── (f) Dispute decision — denied ────────────────────────────────────────
  {
    key: "dispute-denied",
    name: "Dispute decision — denied",
    trigger:
      "Fires when an admin denies an affiliate-submitted conversion dispute. Explains the outcome and links back to the portal.",
    recipient: "Affiliate",
    render() {
      const resolutionBlock = `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;"><strong>Note from our team:</strong><br/>The order pre-dated the first tracked click on your referral link, so it falls outside the attribution window.</p>`;
      const contentHtml = `
        <p>Hi ${SAMPLE_FIRST},</p>
        <p>We've reviewed your dispute and weren't able to approve it this time.</p>
        ${resolutionBlock}
        ${emailButton("View your disputes", SAMPLE_DISPUTES)}
        <p style="font-size:13px;color:#64748b;">— The Chief AI Officer Affiliate Team</p>`;
      return {
        subject: "Update on your referral dispute",
        html: renderBrandedEmail({
          heading: "Update on your dispute",
          contentHtml,
          preheader: "An update on the referral dispute you submitted.",
        }),
      };
    },
  },
];
