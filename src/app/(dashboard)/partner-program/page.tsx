// Partner Program overview — server component.
// Queries summary stats directly from the DB and renders a fully
// server-side overview page (no client component required).

import { db } from "@/lib/db";
import {
  partners,
  partnerConversions,
  partnerPrograms,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guard";
import { eq, inArray, sql, desc } from "drizzle-orm";
import {
  Handshake,
  Users,
  Clock,
  DollarSign,
  CheckCircle2,
  Activity,
  FileText,
  AlertCircle,
  Settings,
  FolderOpen,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import NextLink from "next/link";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function ConversionStatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    earned: "bg-blue-100 text-blue-700",
    paid: "bg-emerald-100 text-emerald-700",
    reversed: "bg-zinc-200 text-zinc-600",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone[status] ?? "bg-zinc-100 text-zinc-700",
      )}
    >
      {status}
    </span>
  );
}

export default async function PartnerProgramPage() {
  await requireAuth();

  // Base URL for the public affiliate-facing pages (set
  // PARTNER_PROGRAM_BASE_URL=https://affiliates.chiefaiofficer.com in Vercel).
  const publicBase = (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).replace(/\/$/, "");

  // ── Summary stats ──────────────────────────────────────────────────────

  // Active partners: status in (active, approved)
  const [{ activeCount }] = await db
    .select({ activeCount: sql<number>`COUNT(*)::int` })
    .from(partners)
    .where(inArray(partners.status, ["active", "approved"]));

  // Pending applications
  const [{ pendingCount }] = await db
    .select({ pendingCount: sql<number>`COUNT(*)::int` })
    .from(partners)
    .where(eq(partners.status, "applied"));

  // Conversions pending review (status = 'pending')
  const [{ pendingConversionsCount }] = await db
    .select({ pendingConversionsCount: sql<number>`COUNT(*)::int` })
    .from(partnerConversions)
    .where(eq(partnerConversions.status, "pending"));

  // Earned but not yet in a payout batch
  const [{ earnedUnpaidCents }] = await db
    .select({
      earnedUnpaidCents: sql<number>`COALESCE(SUM(commission_cents), 0)::int`,
    })
    .from(partnerConversions)
    .where(
      sql`status = 'earned' AND payout_batch_id IS NULL`,
    );

  // Paid to date
  const [{ paidToDateCents }] = await db
    .select({
      paidToDateCents: sql<number>`COALESCE(SUM(commission_cents), 0)::int`,
    })
    .from(partnerConversions)
    .where(eq(partnerConversions.status, "paid"));

  // Recent conversions — last 8, joined to partner name + program name
  const recentConversions = await db
    .select({
      id: partnerConversions.id,
      buyerEmail: partnerConversions.buyerEmail,
      commissionCents: partnerConversions.commissionCents,
      status: partnerConversions.status,
      purchasedAt: partnerConversions.purchasedAt,
      partnerName: partners.name,
      programName: partnerPrograms.name,
    })
    .from(partnerConversions)
    .leftJoin(partners, eq(partnerConversions.partnerId, partners.id))
    .leftJoin(
      partnerPrograms,
      eq(partnerConversions.programId, partnerPrograms.id),
    )
    .orderBy(desc(partnerConversions.purchasedAt))
    .limit(8);

  // ── Quick-link cards — exactly four core surfaces ──────────────────────
  const quickLinks = [
    {
      href: "/partner-program/partners",
      icon: Users,
      label: "Partners",
      desc: "Manage approved & active affiliates",
    },
    {
      href: "/partner-program/applications",
      icon: FileText,
      label: "Applications",
      desc: "Review pending applications",
      badge: pendingCount > 0 ? String(pendingCount) : undefined,
    },
    {
      href: "/partner-program/events",
      icon: Activity,
      label: "Events",
      desc: "Attribution, conversions & payouts pipeline",
      badge:
        pendingConversionsCount > 0
          ? String(pendingConversionsCount)
          : undefined,
    },
    {
      href: "/partner-program/disputes",
      icon: AlertCircle,
      label: "Disputes",
      desc: "Affiliate-submitted conversion disputes",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Affiliate Program
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Affiliate commission overview — active affiliates, pending
            commissions, and recent activity.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NextLink
            href="/partner-program/resources"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <FolderOpen className="h-4 w-4" />
            Resources
          </NextLink>
          <NextLink
            href="/partner-program/settings"
            aria-label="Program settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          >
            <Settings className="h-4 w-4" />
          </NextLink>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          icon={<Users className="h-4 w-4 text-zinc-400" />}
          label="Active Affiliates"
          value={String(activeCount)}
        />
        <MetricCard
          icon={<Clock className="h-4 w-4 text-amber-400" />}
          label="Pending Conversions"
          value={String(pendingConversionsCount)}
          highlight={pendingConversionsCount > 0}
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4 text-blue-400" />}
          label="Earned (unpaid)"
          value={fmtUsd(earnedUnpaidCents)}
          highlight={earnedUnpaidCents > 0}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          label="Paid to Date"
          value={fmtUsd(paidToDateCents)}
        />
      </div>

      {/* Public affiliate-facing pages */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Public pages (share with affiliates)
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { href: `${publicBase}/partners`, label: "Landing page", sub: "Marketing + commission table" },
              { href: `${publicBase}/partners/apply`, label: "Apply to join", sub: "Public application form" },
              { href: `${publicBase}/partners/resources`, label: "Resources", sub: "Playbook, toolkit, assets" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 transition hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-800">
                    {l.label}
                    <ExternalLink className="h-3 w-3 text-zinc-400" />
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">{l.sub}</div>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Admin Surfaces
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quickLinks.map(({ href, icon: Icon, label, desc, badge }) => (
            <NextLink key={href} href={href}>
              <Card className="cursor-pointer hover:shadow-md transition group h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 group-hover:bg-zinc-200 transition">
                    <Icon className="h-4 w-4 text-zinc-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">
                        {label}
                      </span>
                      {badge && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 leading-snug">
                      {desc}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-zinc-500 transition mt-1" />
                </CardContent>
              </Card>
            </NextLink>
          ))}
        </div>
      </div>

      {/* Recent conversions */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Recent Conversions
          </h2>
          <NextLink
            href="/partner-program/events"
            className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
          >
            View all
          </NextLink>
        </div>

        {recentConversions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-zinc-400">
              No conversions recorded yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="text-left px-4 py-2">Buyer</th>
                    <th className="text-left px-4 py-2">Program</th>
                    <th className="text-left px-4 py-2">Affiliate</th>
                    <th className="text-right px-4 py-2">Commission</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentConversions.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t hover:bg-zinc-50 transition"
                    >
                      <td className="px-4 py-2 font-mono text-xs text-zinc-700 max-w-[180px] truncate">
                        {c.buyerEmail}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-700 max-w-[160px] truncate">
                        {c.programName ?? (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-700 max-w-[140px] truncate">
                        {c.partnerName ?? (
                          <span className="text-zinc-400">unmatched</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs text-zinc-900">
                        {fmtUsd(c.commissionCents)}
                      </td>
                      <td className="px-4 py-2">
                        <ConversionStatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500">
                        {format(c.purchasedAt, "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
          {icon}
          {label}
        </div>
        <div
          className={cn(
            "mt-1 text-xl font-semibold tabular-nums",
            highlight ? "text-amber-700" : "text-zinc-900",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
