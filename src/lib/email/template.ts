// =============================================================
// Master branded email template — used by every system email so they share a
// professional, consistent header + footer. Pass in the inner content HTML.
// =============================================================

const SITE = "https://chiefaiofficer.com";
const AFFILIATES = "https://affiliates.chiefaiofficer.com";
const LOGO_URL = `${AFFILIATES}/caio-logo-white.png`;
const ADDRESS = "5700 Harper Dr, Suite 210, Albuquerque, NM 87109, United States";

const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: "Certifications", href: `${SITE}/certifications` },
  { label: "Why Us", href: `${SITE}/why-us` },
  { label: "Blog + Insights", href: `${SITE}/blog` },
  { label: "Contact", href: `${SITE}/contact` },
  { label: "Community", href: `${SITE}/community` },
  { label: "Become an Affiliate", href: `${AFFILIATES}/partners` },
];

export interface BrandedEmailOptions {
  /** Main heading shown at the top of the content card. */
  heading: string;
  /** Inner HTML (paragraphs, lists, buttons). Caller is responsible for escaping user data. */
  contentHtml: string;
  /** Hidden preview text shown in the inbox list. */
  preheader?: string;
}

/** A reusable CTA button (email-safe, table-based). */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:#4f46e5;">
    <a href="${url}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
  </td></tr></table>`;
}

export function renderBrandedEmail({
  heading,
  contentHtml,
  preheader,
}: BrandedEmailOptions): string {
  const year = "2026";
  const links = FOOTER_LINKS.map(
    (l) =>
      `<a href="${l.href}" style="color:#6b7280;text-decoration:none;font-size:13px;">${l.label}</a>`,
  ).join('<span style="color:#d1d5db;"> &nbsp;·&nbsp; </span>');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- Header -->
      <tr><td style="background:#0b0b0f;border-radius:14px 14px 0 0;padding:20px 32px;" align="left">
        <img src="${LOGO_URL}" alt="Chief AI Officer" height="26" style="height:26px;vertical-align:middle;border:0;">
        <span style="vertical-align:middle;margin-left:10px;font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Chief AI Officer</span>
      </td></tr>

      <!-- Content card -->
      <tr><td style="background:#ffffff;padding:34px 32px 30px;">
        <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:#111827;">${heading}</h1>
        <div style="font-size:15px;line-height:1.62;color:#3f3f46;">${contentHtml}</div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#fafafa;border-top:1px solid #ececec;padding:22px 32px;border-radius:0;">
        <div style="line-height:1.9;">${links}</div>
      </td></tr>
      <tr><td style="background:#0b0b0f;border-radius:0 0 14px 14px;padding:22px 32px;">
        <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#a1a1aa;">
          You're receiving this because you're part of the Chief AI Officer Affiliate Program.
        </p>
        <p style="margin:0 0 10px;font-size:12px;line-height:1.6;">
          <a href="${AFFILIATES}/partners/terms" style="color:#d4d4d8;text-decoration:underline;">Terms</a> &nbsp;·&nbsp;
          <a href="${AFFILIATES}/partners/privacy" style="color:#d4d4d8;text-decoration:underline;">Privacy Policy</a> &nbsp;·&nbsp;
          <a href="${SITE}" style="color:#d4d4d8;text-decoration:underline;">ChiefAIOfficer.com</a>
        </p>
        <p style="margin:0;font-size:12px;color:#71717a;">© ${year} Chief AI Officer. All rights reserved.<br>${ADDRESS}</p>
      </td></tr>

    </table>
  </td></tr></table>
</body></html>`;
}
