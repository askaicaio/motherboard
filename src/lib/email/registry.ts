// =============================================================
// Email template registry — a single source of truth describing EVERY system
// email the affiliate platform sends. Each descriptor knows when/why it fires,
// who receives it, and carries the editable defaults (subject / heading / body)
// with {{var}} tokens. Admins can override any field per template; the merge of
// "DB override over these defaults" lives in ./render.ts.
//
// The defaults below are lifted verbatim from the original inline email copy in
// the apply / approve / dispute-decide routes and portal-auth helper, with the
// dynamic values swapped for {{tokens}} so they can be interpolated at send time
// and wrapped in renderBrandedEmail() (header/footer stay fixed).
// =============================================================

export interface EmailVariable {
  name: string;
  sample: string;
  description?: string;
}

export interface EmailTemplateDescriptor {
  /** Stable identifier (primary key in partner_email_templates). */
  key: string;
  /** Human-friendly name. */
  name: string;
  /** Plain-English description of when/why this email fires. */
  trigger: string;
  /** Who receives it. */
  recipient: "Affiliate" | "Admin";
  /** Default subject line — may contain {{var}} tokens. */
  defaultSubject: string;
  /** Default content heading (editable) — may contain {{var}} tokens. */
  defaultHeading: string;
  /** Default inner content HTML (editable) — may contain {{var}} tokens. */
  defaultBodyHtml: string;
  /** Every {{var}} used in this template, with a representative sample value. */
  variables: EmailVariable[];
}

export const EMAIL_TEMPLATES: EmailTemplateDescriptor[] = [
  // ── application_received — to the applicant ──────────────────────────────
  {
    key: "application_received",
    name: "Application received",
    trigger:
      "Fires the moment a prospective affiliate submits the public application form. Confirms we got it and sets expectations for review.",
    recipient: "Affiliate",
    defaultSubject:
      "We received your Chief AI Officer affiliate application",
    defaultHeading: "We received your application",
    defaultBodyHtml: `<p>Hi {{firstName}},</p>
<p>Thank you for applying to the Chief AI Officer Affiliate Program! We review every application personally and will be in touch within 3 business days.</p>
<p>Here's a quick recap of what to expect:</p>
<ul>
  <li><strong>10% flat commission</strong> on every closed deal you refer</li>
  <li><strong>60-day cookie window</strong> from first click</li>
  <li><strong>Net-45 payouts</strong> via ACH or Zelle (W-9 / W-8BEN required)</li>
</ul>
<p>If you have any questions in the meantime, feel free to reply to this email.</p>
<p>— The Chief AI Officer Team</p>`,
    variables: [
      {
        name: "firstName",
        sample: "Jordan",
        description: "Applicant's first name.",
      },
    ],
  },

  // ── new_application — to the admin inbox (partners@) ─────────────────────
  {
    key: "new_application",
    name: "New application (admin notification)",
    trigger:
      "Fires alongside the applicant confirmation whenever the public application form is submitted. Sent to partners@chiefaiofficer.com so staff can review.",
    recipient: "Admin",
    defaultSubject: "New affiliate application: {{name}}",
    defaultHeading: "New affiliate application",
    defaultBodyHtml: `<p>A new affiliate application was submitted.</p>
<table style="border-collapse:collapse;font-size:14px;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>{{name}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>{{email}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Location</td><td>{{location}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Heard via</td><td>{{howHeard}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Audience size</td><td>{{audienceSize}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Tax form</td><td><a href="{{taxLink}}">View tax form</a></td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="{{reviewLink}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Review in Motherboard →</a>
</td></tr></table>`,
    variables: [
      { name: "name", sample: "Jordan Avery", description: "Applicant's full name." },
      {
        name: "email",
        sample: "jordan.avery@example.com",
        description: "Applicant's email address.",
      },
      {
        name: "location",
        sample: "Austin, TX, United States",
        description: "City, state, country.",
      },
      {
        name: "howHeard",
        sample: "LinkedIn",
        description: "How the applicant heard about the program.",
      },
      {
        name: "audienceSize",
        sample: "24500",
        description: "Self-reported audience size.",
      },
      {
        name: "taxLink",
        sample:
          "https://chiefaiofficer.com/api/partners/sample-id/tax-form",
        description: "Admin-gated link to the submitted W-9/W-8BEN.",
      },
      {
        name: "reviewLink",
        sample: "https://chiefaiofficer.com/partner-program/applications",
        description: "Link to the applications review queue.",
      },
    ],
  },

  // ── approved — temp password — to the affiliate ──────────────────────────
  {
    key: "approved",
    name: "Approved — temporary password",
    trigger:
      "Fires when an admin approves a pending application. Delivers the affiliate's referral link, a temporary portal password, and the login link.",
    recipient: "Affiliate",
    defaultSubject: "You're approved for the CAIO Affiliate Program",
    defaultHeading: "You're approved!",
    defaultBodyHtml: `<p>Hi {{name}},</p>
<p>Great news — your application to the CAIO Affiliate Program has been approved!</p>
<p>Your personal referral link is:</p>
<p><a href="{{referralLink}}">{{referralLink}}</a></p>
<p>Share it with anyone who could benefit from working with a Chief AI Officer. When they engage through your link, you'll earn commission on qualifying sales.</p>
<p>Sign in to your affiliate portal to track your clicks, conversions, and payouts.</p>
<p>Your temporary password is: <strong>{{tempPassword}}</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="{{loginUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Sign in to your portal →</a>
</td></tr></table>
<p>You'll be asked to choose your own password on first sign-in.</p>
<p>Welcome aboard,<br/>The CAIO Team</p>`,
    variables: [
      { name: "name", sample: "Jordan Avery", description: "Affiliate's full name." },
      {
        name: "referralLink",
        sample: "https://affiliates.chiefaiofficer.com/r?aff=JORDANA1",
        description: "The affiliate's personal referral link.",
      },
      {
        name: "tempPassword",
        sample: "Caio-a1B2c3D4",
        description: "Temporary portal password (changed on first sign-in).",
      },
      {
        name: "loginUrl",
        sample: "https://affiliates.chiefaiofficer.com/portal/login",
        description: "Portal login URL.",
      },
    ],
  },

  // ── password_reset — to the affiliate ────────────────────────────────────
  {
    key: "password_reset",
    name: "Password reset link",
    trigger:
      "Fires when an affiliate requests a password reset. Contains a one-time link valid for 7 days.",
    recipient: "Affiliate",
    defaultSubject: "Reset your CAIO affiliate portal password",
    defaultHeading: "Reset your password",
    defaultBodyHtml: `<p>Hi {{name}},</p>
<p>We received a request to reset your CAIO affiliate portal password. Use the link below to set a new one.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="{{resetUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password →</a>
</td></tr></table>
<p style="margin-top:24px;font-size:12px;color:#a1a1aa;line-height:1.6;">This link is valid for 7 days. If you weren't expecting it, you can ignore this email.</p>`,
    variables: [
      { name: "name", sample: "Jordan Avery", description: "Affiliate's full name." },
      {
        name: "resetUrl",
        sample:
          "https://affiliates.chiefaiofficer.com/portal/set-password?token=sample-token-7f3a9c",
        description: "One-time set-password link (valid 7 days).",
      },
    ],
  },

  // ── dispute_upheld — to the affiliate ────────────────────────────────────
  {
    key: "dispute_upheld",
    name: "Dispute decision — approved",
    trigger:
      "Fires when an admin upholds (approves) an affiliate-submitted conversion dispute. Tells the affiliate the outcome and, when a credit was issued, that it's on its way.",
    recipient: "Affiliate",
    defaultSubject: "Your referral dispute was approved",
    defaultHeading: "Your dispute was approved",
    defaultBodyHtml: `<p style="margin:0 0 16px;">Hi {{name}},</p>
<p style="margin:0 0 16px;">Good news — we reviewed your dispute and approved it.</p>
{{creditLine}}
{{resolution}}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="https://affiliates.chiefaiofficer.com/portal/disputes" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View your disputes</a>
</td></tr></table>
<p style="font-size:13px;color:#64748b;">— The Chief AI Officer Affiliate Team</p>`,
    variables: [
      {
        name: "name",
        sample: "Jordan",
        description: "Affiliate's first name (used in the greeting).",
      },
      {
        name: "creditLine",
        sample:
          `<p style="margin:0 0 16px;">We've added the earned commission to your account. It now appears in your Events and will be included in your next payout — no further action needed.</p>`,
        description:
          "Optional HTML sentence about the credit when one was created; empty otherwise.",
      },
      {
        name: "resolution",
        sample:
          `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;"><strong>Note from our team:</strong><br/>We matched the order to your click within the cookie window — the commission is now on its way.</p>`,
        description:
          "Optional HTML 'note from our team' block; empty when no resolution text was entered.",
      },
    ],
  },

  // ── dispute_denied — to the affiliate ────────────────────────────────────
  {
    key: "dispute_denied",
    name: "Dispute decision — denied",
    trigger:
      "Fires when an admin denies an affiliate-submitted conversion dispute. Explains the outcome and links back to the portal.",
    recipient: "Affiliate",
    defaultSubject: "Update on your referral dispute",
    defaultHeading: "Update on your dispute",
    defaultBodyHtml: `<p style="margin:0 0 16px;">Hi {{name}},</p>
<p style="margin:0 0 16px;">We've reviewed your dispute and weren't able to approve it this time.</p>
{{resolution}}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="https://affiliates.chiefaiofficer.com/portal/disputes" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View your disputes</a>
</td></tr></table>
<p style="font-size:13px;color:#64748b;">— The Chief AI Officer Affiliate Team</p>`,
    variables: [
      {
        name: "name",
        sample: "Jordan",
        description: "Affiliate's first name (used in the greeting).",
      },
      {
        name: "resolution",
        sample:
          `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;"><strong>Note from our team:</strong><br/>The order pre-dated the first tracked click on your referral link, so it falls outside the attribution window.</p>`,
        description:
          "Optional HTML 'note from our team' block; empty when no resolution text was entered.",
      },
    ],
  },
];

export function getTemplateDescriptor(
  key: string,
): EmailTemplateDescriptor | undefined {
  return EMAIL_TEMPLATES.find((t) => t.key === key);
}
