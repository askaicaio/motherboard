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
  const referralLink = `${base}/r?aff=${partner.refCode}`;

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
        <h1 className="text-2xl font-semibold tracking-tight text-[#1e1b4b]">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here&rsquo;s how your referrals are performing.
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

      {/* Referral link */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1e1b4b]">
          Your referral link
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Share this link anywhere. Every click is attributed to you for 60
          days.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-sm text-slate-700">
            {referralLink}
          </div>
          <CopyLinkButton value={referralLink} />
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
