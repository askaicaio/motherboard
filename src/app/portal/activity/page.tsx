import { Activity } from "lucide-react";
import { requirePartner } from "@/lib/partners/session";
import { db } from "@/lib/db";
import {
  partnerConversions,
  partnerPrograms,
  partnerPayoutBatches,
} from "@/lib/db/schema";
import { and, eq, desc, ne, sql } from "drizzle-orm";
import { getActiveSettings } from "@/lib/partners/queries";
import { computeExpectedPayoutDate } from "@/lib/partners/rules";
import { ActivityClient, type ActivityRow } from "./activity-client";

export const dynamic = "force-dynamic";

// Slots into the portal layout's title template ("%s · Affiliate Portal").
export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const partner = await requirePartner();

  const [rows, settings] = await Promise.all([
    db
      .select({
        id: partnerConversions.id,
        buyerEmail: partnerConversions.buyerEmail,
        commissionCents: partnerConversions.commissionCents,
        status: partnerConversions.status,
        source: partnerConversions.source,
        purchasedAt: partnerConversions.purchasedAt,
        createdAt: partnerConversions.createdAt,
        refundWindowEndsAt: partnerConversions.refundWindowEndsAt,
        earnedAt: partnerConversions.earnedAt,
        paidAt: partnerPayoutBatches.paidAt,
        programName: partnerPrograms.name,
      })
      .from(partnerConversions)
      .leftJoin(
        partnerPrograms,
        eq(partnerConversions.programId, partnerPrograms.id),
      )
      .leftJoin(
        partnerPayoutBatches,
        eq(partnerConversions.payoutBatchId, partnerPayoutBatches.id),
      )
      .where(
        and(
          eq(partnerConversions.partnerId, partner.id),
          ne(partnerConversions.source, "clawback"),
        ),
      )
      .orderBy(
        desc(
          sql`coalesce(${partnerConversions.purchasedAt}, ${partnerConversions.createdAt})`,
        ),
      ),
    getActiveSettings(new Date()),
  ]);

  const payoutTermsDays = settings?.payoutTermsDays ?? 45;
  const minPayoutCents = settings?.minPayoutCents ?? 10000;
  const refundWindowDays = settings?.refundWindowDays ?? 7;

  const activityRows: ActivityRow[] = rows.map((r) => {
    const status = (r.status as ActivityRow["status"]) ?? "pending";
    const expected = computeExpectedPayoutDate(
      {
        status,
        earnedAt: r.earnedAt,
        refundWindowEndsAt: r.refundWindowEndsAt,
      },
      payoutTermsDays,
    );
    return {
      id: r.id,
      programName: r.programName ?? null,
      buyerEmail: r.buyerEmail,
      commissionCents: Number(r.commissionCents),
      status,
      purchasedAt: r.purchasedAt ? r.purchasedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      expectedPayoutAt: expected ? expected.toISOString() : null,
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[#1e1b4b]">
          <Activity className="h-6 w-6 text-[#4f46e5]" />
          Referral activity
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Conversions attributed to your referrals. Sort, search, or group by
          status.
        </p>
      </header>

      <ActivityClient
        rows={activityRows}
        payoutTermsDays={payoutTermsDays}
        minPayoutCents={minPayoutCents}
        refundWindowDays={refundWindowDays}
      />

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          What the statuses mean
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              Pending
            </span>
            <span>
              Your referral purchased. New commissions are held for a short
              {" "}{refundWindowDays}-day window in case the customer requests a
              refund — once it passes with no refund, this clears to Earned.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-[#4f46e5] ring-1 ring-indigo-200">
              Earned
            </span>
            <span>Cleared and awaiting payout in an upcoming batch.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              Paid
            </span>
            <span>Paid out to you.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
