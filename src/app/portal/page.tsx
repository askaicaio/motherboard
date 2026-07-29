import Link from "next/link";
import {
  MousePointerClick,
  Users,
  Clock,
  CircleDollarSign,
  BadgeCheck,
  AlertTriangle,
} from "lucide-react";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerClicks, partnerConversions } from "@/lib/db/schema";
import { requirePartner } from "@/lib/partners/session";
import { CopyLinkButton } from "@/components/portal/copy-link-button";

export const dynamic = "force-dynamic";

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default async function PortalDashboardPage() {
  const partner = await requirePartner();

  // --- Metrics, all strictly scoped to THIS partner ---
  const [clicksRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(partnerClicks)
    .where(eq(partnerClicks.partnerId, partner.id));

  const [conversionsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(partnerConversions)
    .where(
      and(
        eq(partnerConversions.partnerId, partner.id),
        ne(partnerConversions.source, "clawback"),
        ne(partnerConversions.status, "rejected"),
      ),
    );

  // Earnings by status. `earned` rows naturally net negative clawback rows.
  const earningsRows = await db
    .select({
      status: partnerConversions.status,
      total: sql<number>`coalesce(sum(${partnerConversions.commissionCents}), 0)::int`,
    })
    .from(partnerConversions)
    .where(eq(partnerConversions.partnerId, partner.id))
    .groupBy(partnerConversions.status);

  const byStatus = new Map(earningsRows.map((r) => [r.status, r.total]));
  const pendingCents = byStatus.get("pending") ?? 0;
  const earnedCents = byStatus.get("earned") ?? 0;
  const paidCents = byStatus.get("paid") ?? 0;

  const totalClicks = clicksRow?.count ?? 0;
  const totalConversions = conversionsRow?.count ?? 0;

  const firstName = partner.name.trim().split(/\s+/)[0] || partner.name;

  const base = (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://affiliates.chiefaiofficer.com"
  ).replace(/\/$/, "");
  // One tracked link per intent — all carry the ref code + set the 60-day
  // cookie via /r, then redirect to the right destination.
  const ref = partner.refCode;
  const enrollDest = encodeURIComponent(`${base}/enroll`);
  const communityUrl = process.env.AFFILIATE_COMMUNITY_URL?.replace(/\/$/, "");
  const referralLinks: { key: string; title: string; hint: string; href: string }[] = [
    {
      key: "booking",
      title: "Book a call",
      hint: "Best for high-ticket / enterprise intros",
      href: `${base}/r?aff=${ref}`,
    },
    {
      key: "buy",
      title: "Buy a program",
      hint: "Sends buyers straight to checkout",
      href: `${base}/r?aff=${ref}&dest=${enrollDest}`,
    },
    {
      key: "assessment",
      title: "AI Readiness Assessment",
      hint: "Share the free quiz — great top-of-funnel opener",
      href: `${base}/r?aff=${ref}&dest=${encodeURIComponent("https://assessment.chiefaiofficer.com/")}`,
    },
    ...(communityUrl
      ? [
          {
            key: "community",
            title: "Join the CAIO Community",
            hint: "Invite people into the community",
            href: `${base}/r?aff=${ref}&dest=${encodeURIComponent(communityUrl)}`,
          },
        ]
      : []),
  ];

  const needsPayoutSetup = partner.stripeConnectStatus !== "ready";

  const metrics = [
    {
      label: "Clicks",
      value: totalClicks.toLocaleString("en-US"),
      icon: MousePointerClick,
    },
    {
      label: "Conversions",
      value: totalConversions.toLocaleString("en-US"),
      icon: Users,
    },
    { label: "Pending", value: usd(pendingCents), icon: Clock },
    {
      label: "Earned (unpaid)",
      value: usd(earnedCents),
      icon: CircleDollarSign,
    },
    { label: "Paid to date", value: usd(paidCents), icon: BadgeCheck },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1e1b4b]">
            Welcome back, {firstName}
          </h1>
          {partner.isSample && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Sample data
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {partner.isSample
            ? "This is a demo account — the clicks, conversions, and earnings below are example data, not real activity."
            : "Here’s how your referrals are performing."}
        </p>
      </header>

      {needsPayoutSetup && (
        <Link
          href="/portal/payouts"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition hover:bg-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            <span className="font-semibold">
              Connect your payout account to get paid.
            </span>{" "}
            Commissions are paid automatically to your connected account — set it
            up on the Payouts page so your earnings can be released.
          </span>
        </Link>
      )}

      {/* Referral links — one per intent */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1e1b4b]">
          Your referral links
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Every click is attributed to you for 60 days. Pick the link that fits
          how you&rsquo;re sharing.
        </p>
        <div className="mt-4 space-y-4">
          {referralLinks.map((l) => (
            <div key={l.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-[#1e1b4b]">
                  {l.title}
                </span>
                <span className="text-[11px] text-slate-400">{l.hint}</span>
              </div>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-sm text-slate-700">
                  {l.href}
                </div>
                <CopyLinkButton value={l.href} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Metric cards */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 text-slate-400">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium text-slate-500">
                  {m.label}
                </span>
              </div>
              <div className="mt-2 text-xl font-semibold tabular-nums text-[#1e1b4b]">
                {m.value}
              </div>
            </div>
          );
        })}
      </section>

      <p className="mt-4 text-xs text-slate-400">
        How you earn: a commission moves from{" "}
        <span className="font-medium text-slate-500">Pending</span> to{" "}
        <span className="font-medium text-slate-500">Earned</span> once the
        refund window closes, then to{" "}
        <span className="font-medium text-slate-500">Paid</span> on the next
        payout run.
      </p>
    </div>
  );
}
