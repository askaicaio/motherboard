// =============================================================
// Renders + sends the periodic affiliate-program report to the internal team.
// Plain internal HTML (a stats table) sent via sendEmail — NOT the affiliate
// branded chrome and NOT notifyProgramEvent (whose fixed event enum + in-app
// bell rows don't fit a digest). Recipients come from AFFILIATE_REPORT_EMAILS,
// falling back to PROGRAM_ALERT_EMAILS, then Dani.
// =============================================================

import { sendEmail } from "@/lib/email/sender";
import type { AffiliateReportStats } from "./report";

const RECIPIENTS = (
  process.env.AFFILIATE_REPORT_EMAILS ||
  process.env.PROGRAM_ALERT_EMAILS ||
  "dani@chiefaiofficer.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://motherboard.chiefaiofficer.com"
).replace(/\/$/, "");

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rowsTable(pairs: Array<[string, string]>): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">${pairs
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#3f3f46;">${k}</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${v}</td></tr>`,
    )
    .join("")}</table>`;
}

export async function sendAffiliateReportEmail(
  stats: AffiliateReportStats,
  window: { start: Date; end: Date; cadence: string },
): Promise<void> {
  if (RECIPIENTS.length === 0) return;

  const cadenceLabel =
    window.cadence.charAt(0).toUpperCase() + window.cadence.slice(1);
  // end is exclusive; show the last day actually covered.
  const rangeLabel = `${fmtDate(window.start)} – ${fmtDate(
    new Date(window.end.getTime() - 1),
  )}`;

  const period: Array<[string, string]> = [
    ["New applications", String(stats.newApplications)],
    ["Affiliates approved", String(stats.approved)],
    [
      "New conversions",
      `${stats.newConversions} (${usd(stats.grossCents)} gross)`,
    ],
    ["Commissions booked", usd(stats.commissionBookedCents)],
    ["Commissions cleared (earned)", usd(stats.commissionEarnedCents)],
    ["Paid out", usd(stats.paidCents)],
  ];
  const standing: Array<[string, string]> = [
    ["Active affiliates", String(stats.activeAffiliates)],
    ["Earned, awaiting payout", usd(stats.earnedUnpaidCents)],
    ["Paid to date", usd(stats.paidToDateCents)],
  ];

  const topRows = stats.topAffiliates.length
    ? stats.topAffiliates
        .map(
          (a, i) =>
            `<tr><td style="padding:6px 16px 6px 0;color:#3f3f46;">${i + 1}. ${escapeHtml(
              a.name,
            )}</td><td style="padding:6px 0;text-align:right;color:#111827;"><strong>${usd(
              a.commissionCents,
            )}</strong> · ${a.deals} deal${a.deals === 1 ? "" : "s"}</td></tr>`,
        )
        .join("")
    : `<tr><td style="padding:6px 0;color:#a1a1aa;">No commissions cleared this period.</td></tr>`;

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:0 0 6px;">Affiliate Program</p>
  <h1 style="font-size:19px;line-height:1.3;margin:0 0 2px;color:#111827;">${cadenceLabel} report</h1>
  <p style="font-size:13px;color:#6b7280;margin:0 0 18px;">${rangeLabel}</p>
  ${rowsTable(period)}
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:24px 0 6px;">Standing totals</p>
  ${rowsTable(standing)}
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:24px 0 6px;">Top affiliates this period</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">${topRows}</table>
  <a href="${APP_URL}/partner-program" style="display:inline-block;margin-top:24px;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;">Open in Motherboard</a>
</div>`;

  const plain = [
    `${cadenceLabel} affiliate report — ${rangeLabel}`,
    "",
    ...period.map(([k, v]) => `${k}: ${v}`),
    "",
    "Standing totals:",
    ...standing.map(([k, v]) => `${k}: ${v}`),
    "",
    "Top affiliates this period:",
    ...(stats.topAffiliates.length
      ? stats.topAffiliates.map(
          (a, i) =>
            `${i + 1}. ${a.name} — ${usd(a.commissionCents)} (${a.deals} deal${
              a.deals === 1 ? "" : "s"
            })`,
        )
      : ["None"]),
  ].join("\n");

  await sendEmail({
    to: RECIPIENTS[0],
    cc: RECIPIENTS.slice(1),
    subject: `[Affiliate Program] ${cadenceLabel} report — ${rangeLabel}`,
    html,
    plain,
  });
}
