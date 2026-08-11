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
  /**
   * Optional override for the branded footer's "why am I getting this" line.
   * Defaults to the affiliate-program wording; buyers / internal recipients set
   * their own so the footer isn't misleading.
   */
  footerReason?: string;
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
  <li><strong>Net-45 payouts</strong> via Stripe Connect (W-9 / W-8BEN required)</li>
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

  // ── application_declined — to the applicant ──────────────────────────────
  {
    key: "application_declined",
    name: "Application declined",
    trigger:
      "Fires when an admin declines a pending application. Lets the applicant know politely and, if the admin entered a reason, includes it.",
    recipient: "Affiliate",
    defaultSubject: "Update on your Chief AI Officer affiliate application",
    defaultHeading: "An update on your application",
    defaultBodyHtml: `<p>Hi {{firstName}},</p>
<p>Thank you for your interest in the Chief AI Officer Affiliate Program and for taking the time to apply.</p>
<p>After reviewing your application, we're not able to move forward with it at this time.</p>
{{reasonBlock}}
<p>This isn't necessarily a permanent no — our program and needs evolve, and you're welcome to re-apply down the road. If you have questions, just reply to this email.</p>
<p>Wishing you all the best,<br/>The Chief AI Officer Team</p>`,
    variables: [
      {
        name: "firstName",
        sample: "Jordan",
        description: "Applicant's first name (used in the greeting).",
      },
      {
        name: "reasonBlock",
        sample:
          `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;"><strong>A note from our team:</strong><br/>Your audience isn't a fit for our program right now.</p>`,
        description:
          "Optional HTML block with the admin-entered decline reason; empty when no reason was given.",
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
<p>Great news — your application to the CAIO Affiliate Program has been approved. Welcome aboard!</p>
<p>Here's how to get set up in three quick steps:</p>
<p style="margin:18px 0 4px;"><strong>1. Sign in to your portal.</strong> Everything lives here — your referral links, clicks, conversions, and payouts. Your temporary password is <strong>{{tempPassword}}</strong> (you'll choose your own on first sign-in).</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="{{loginUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Sign in to your portal →</a>
</td></tr></table>
<p style="margin:18px 0 4px;"><strong>2. Connect your payout account.</strong> Before we can pay you, open <strong>Payouts</strong> in your portal and connect your bank through Stripe. It takes a couple of minutes and securely handles your tax form and payments. <strong>You won't receive any payouts until this is done</strong>, so it's worth doing right away.</p>
<p style="margin:18px 0 4px;"><strong>3. Start sharing your referral link:</strong></p>
<p><a href="{{referralLink}}">{{referralLink}}</a></p>
<p>This link books people straight into a call with our team — the best way to turn a referral into a closed deal. You'll find more link options (and can copy them anytime) inside your portal.</p>
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
          `<p style="margin:0 0 16px;">We've added the earned commission to your account. It now appears in your Activity and will be included in your next payout — no further action needed.</p>`,
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

  // ── affiliate_paid — to the affiliate ────────────────────────────────────
  {
    key: "affiliate_paid",
    name: "Payout sent",
    trigger:
      "Fires when an affiliate's earned commissions are paid out to their connected account via Stripe Connect (the auto payout cron or the manual 'Send payout now' action).",
    recipient: "Affiliate",
    defaultSubject: "You've been paid {{amount}} — CAIO Affiliate Program",
    defaultHeading: "You've been paid {{amount}}",
    defaultBodyHtml: `<p>Hi {{name}},</p>
<p>Great news — we just sent <strong>{{amount}}</strong> to your connected Stripe account for {{referrals}}. Funds typically arrive within a couple of business days, depending on your bank.</p>
<p>You can see the full breakdown any time in your portal.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="https://affiliates.chiefaiofficer.com/portal" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View your portal →</a>
</td></tr></table>
<p>Thanks for partnering with us,<br/>The CAIO Team</p>`,
    variables: [
      { name: "name", sample: "Jordan", description: "Affiliate's first name." },
      {
        name: "amount",
        sample: "$142.50",
        description: "Total amount paid in this payout.",
      },
      {
        name: "referrals",
        sample: "3 referrals",
        description: "Human count of referrals included, e.g. '3 referrals'.",
      },
    ],
  },

  // ── commission_reversed — to the affiliate ───────────────────────────────
  {
    key: "commission_reversed",
    name: "Commission reversed",
    trigger:
      "Fires when a previously earned or paid commission is reversed because the underlying purchase was refunded or disputed (chargeback).",
    recipient: "Affiliate",
    defaultSubject: "Update on one of your CAIO referrals",
    defaultHeading: "A commission was reversed",
    defaultBodyHtml: `<p>Hi {{name}},</p>
<p>We wanted to let you know that a commission of <strong>{{amount}}</strong> on one of your referrals has been reversed.</p>
{{reasonBlock}}
<p>If that commission was already included in a payout, it's simply netted against a future payout — there's nothing you need to do. You can review the details any time in your portal.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="https://affiliates.chiefaiofficer.com/portal" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View your portal →</a>
</td></tr></table>
<p>Questions? Just reply to this email.<br/>The CAIO Team</p>`,
    variables: [
      {
        name: "name",
        sample: "Jordan",
        description: "Affiliate's first name (used in the greeting).",
      },
      {
        name: "amount",
        sample: "$47.50",
        description: "The reversed commission amount.",
      },
      {
        name: "reasonBlock",
        sample: `<p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:4px;color:#334155;">The customer was refunded, so this referral no longer qualifies for a commission.</p>`,
        description:
          "Optional HTML block explaining why (refund vs dispute); empty if none.",
      },
    ],
  },

  // ── referral_verified — to the affiliate ─────────────────────────────────
  {
    key: "referral_verified",
    name: "Referral verified",
    trigger:
      "Fires when a referred purchase clears the refund window and its commission is confirmed (pending → earned). Thanks the affiliate and states the expected payout date.",
    recipient: "Affiliate",
    defaultSubject: "Your referral is confirmed — {{amount}} commission",
    defaultHeading: "Your referral is confirmed",
    defaultBodyHtml: `<p>Hi {{name}},</p>
<p>Good news — {{referrals}} cleared our verification window, and <strong>{{amount}}</strong> in commission is now confirmed (earned).</p>
<p>It's scheduled to be paid <strong>on or after {{expectedPayoutDate}}</strong>, once your balance reaches the {{minPayout}} minimum and your payout account is connected via Stripe.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
  <a href="https://affiliates.chiefaiofficer.com/portal/activity" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View your activity →</a>
</td></tr></table>
<p>Thank you for spreading the word,<br/>The CAIO Team</p>`,
    variables: [
      { name: "name", sample: "Jordan", description: "Affiliate's first name." },
      {
        name: "referrals",
        sample: "1 referral",
        description: "Human count of referrals confirmed, e.g. '1 referral'.",
      },
      {
        name: "amount",
        sample: "$47.50",
        description: "Total commission confirmed.",
      },
      {
        name: "expectedPayoutDate",
        sample: "March 17, 2026",
        description: "Earliest expected payout date (Net-45 maturity).",
      },
      {
        name: "minPayout",
        sample: "$100",
        description: "Minimum balance required before a payout is sent.",
      },
    ],
  },

  // ── purchase_confirmation — to the buyer (referred customer) ──────────────
  {
    key: "purchase_confirmation",
    name: "Purchase confirmation",
    trigger:
      "Fires when someone completes a purchase via Stripe checkout. A generic thank-you / welcome so buyers aren't left with only the raw Stripe receipt.",
    recipient: "Affiliate",
    defaultSubject: "Thanks for your purchase, {{firstName}} — welcome to Chief AI Officer",
    defaultHeading: "Thank you for your purchase",
    defaultBodyHtml: `<p>Hi {{firstName}},</p>
<p>Thank you for enrolling in <strong>{{programName}}</strong>. We've received your payment of <strong>{{amount}}</strong>.</p>
<p>Our team will be in touch shortly with your onboarding details and next steps. In the meantime, if you have any questions, just reply to this email — a real person will get back to you.</p>
<p>Welcome aboard,<br/>The Chief AI Officer Team</p>`,
    variables: [
      {
        name: "firstName",
        sample: "Jordan",
        description: "Buyer's first name (falls back to 'there').",
      },
      {
        name: "programName",
        sample: "AI Leadership Certification",
        description: "The program that was purchased.",
      },
      {
        name: "amount",
        sample: "$12,000",
        description: "Amount actually paid.",
      },
    ],
    footerReason:
      "You're receiving this because you purchased a Chief AI Officer program.",
  },

  // ── purchase_handover — to the internal handover / onboarding team ────────
  {
    key: "purchase_handover",
    name: "New purchase — handover",
    trigger:
      "Fires alongside the buyer confirmation on every purchase. Sent to the handover/onboarding team (HANDOVER_TEAM_EMAIL) so they can onboard the new client.",
    recipient: "Admin",
    defaultSubject: "New client to onboard: {{programName}} — {{buyerName}}",
    defaultHeading: "New client to onboard",
    defaultBodyHtml: `<p>A new client just purchased a program and needs onboarding.</p>
<table style="border-collapse:collapse;font-size:14px;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Client</td><td>{{buyerName}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>{{buyerEmail}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Program</td><td>{{programName}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Amount paid</td><td>{{amount}}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Referred by</td><td>{{referredBy}}</td></tr>
</table>`,
    variables: [
      { name: "buyerName", sample: "Jordan Avery", description: "Client's full name." },
      {
        name: "buyerEmail",
        sample: "jordan.avery@example.com",
        description: "Client's email address (reach out to onboard).",
      },
      {
        name: "programName",
        sample: "AI Leadership Certification",
        description: "The program purchased.",
      },
      { name: "amount", sample: "$12,000", description: "Amount actually paid." },
      {
        name: "referredBy",
        sample: "JORDANA1",
        description: "Referring affiliate's code, or 'direct' if none.",
      },
    ],
    footerReason: "You're receiving this as a member of the Chief AI Officer team.",
  },
];

export function getTemplateDescriptor(
  key: string,
): EmailTemplateDescriptor | undefined {
  return EMAIL_TEMPLATES.find((t) => t.key === key);
}
