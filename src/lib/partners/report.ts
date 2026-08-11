// =============================================================
// Affiliate-program stats for a date window — building blocks for the periodic
// internal report. All money is integer cents. Every count/sum excludes sample
// (isSample) rows so seeded demo data never inflates the numbers. Windows are
// half-open [start, end) and computed by the caller in UTC.
// =============================================================

import { db } from "@/lib/db";
import {
  partners,
  partnerConversions,
  partnerPayoutBatches,
} from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";

export interface AffiliateReportStats {
  // This period.
  newApplications: number;
  approved: number;
  newConversions: number;
  grossCents: number;
  commissionBookedCents: number;
  commissionEarnedCents: number;
  paidCents: number;
  // Standing totals (all-time, as of the report time).
  activeAffiliates: number;
  earnedUnpaidCents: number;
  paidToDateCents: number;
  topAffiliates: Array<{ name: string; commissionCents: number; deals: number }>;
}

export async function buildAffiliateReport(
  start: Date,
  end: Date,
): Promise<AffiliateReportStats> {
  const notSampleP = eq(partners.isSample, false);
  const notSampleC = eq(partnerConversions.isSample, false);

  // Applications received this period (a new partner row = a new application).
  const [{ newApplications }] = await db
    .select({ newApplications: sql<number>`COUNT(*)::int` })
    .from(partners)
    .where(
      and(notSampleP, gte(partners.createdAt, start), lt(partners.createdAt, end)),
    );

  // Affiliates approved this period.
  const [{ approved }] = await db
    .select({ approved: sql<number>`COUNT(*)::int` })
    .from(partners)
    .where(
      and(
        notSampleP,
        isNotNull(partners.approvedAt),
        gte(partners.approvedAt, start),
        lt(partners.approvedAt, end),
      ),
    );

  // New conversions recorded this period, with gross + commission booked.
  const [conv] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      gross: sql<number>`COALESCE(SUM(gross_cents),0)::int`,
      commission: sql<number>`COALESCE(SUM(commission_cents),0)::int`,
    })
    .from(partnerConversions)
    .where(
      and(
        notSampleC,
        gte(partnerConversions.createdAt, start),
        lt(partnerConversions.createdAt, end),
      ),
    );

  // Commissions that CLEARED (pending→earned) this period — range on earnedAt.
  const [{ commissionEarnedCents }] = await db
    .select({
      commissionEarnedCents: sql<number>`COALESCE(SUM(commission_cents),0)::int`,
    })
    .from(partnerConversions)
    .where(
      and(
        notSampleC,
        isNotNull(partnerConversions.earnedAt),
        gte(partnerConversions.earnedAt, start),
        lt(partnerConversions.earnedAt, end),
      ),
    );

  // Paid out this period — range on the batch's paidAt (conversions have no paidAt).
  const [{ paidCents }] = await db
    .select({ paidCents: sql<number>`COALESCE(SUM(total_cents),0)::int` })
    .from(partnerPayoutBatches)
    .where(
      and(
        eq(partnerPayoutBatches.status, "paid"),
        isNotNull(partnerPayoutBatches.paidAt),
        gte(partnerPayoutBatches.paidAt, start),
        lt(partnerPayoutBatches.paidAt, end),
      ),
    );

  // ── Standing totals (all-time) ──
  const [{ activeAffiliates }] = await db
    .select({ activeAffiliates: sql<number>`COUNT(*)::int` })
    .from(partners)
    .where(and(inArray(partners.status, ["active", "approved"]), notSampleP));

  const [{ earnedUnpaidCents }] = await db
    .select({
      earnedUnpaidCents: sql<number>`COALESCE(SUM(commission_cents),0)::int`,
    })
    .from(partnerConversions)
    .where(and(sql`status = 'earned' AND payout_batch_id IS NULL`, notSampleC));

  const [{ paidToDateCents }] = await db
    .select({
      paidToDateCents: sql<number>`COALESCE(SUM(commission_cents),0)::int`,
    })
    .from(partnerConversions)
    .where(and(eq(partnerConversions.status, "paid"), notSampleC));

  // Top affiliates by commission cleared this period.
  const topAffiliates = await db
    .select({
      name: partners.name,
      commissionCents: sql<number>`COALESCE(SUM(${partnerConversions.commissionCents}),0)::int`,
      deals: sql<number>`COUNT(*)::int`,
    })
    .from(partnerConversions)
    .innerJoin(partners, eq(partnerConversions.partnerId, partners.id))
    .where(
      and(
        notSampleC,
        eq(partners.isSample, false),
        isNotNull(partnerConversions.earnedAt),
        gte(partnerConversions.earnedAt, start),
        lt(partnerConversions.earnedAt, end),
      ),
    )
    .groupBy(partners.id, partners.name)
    .orderBy(desc(sql`COALESCE(SUM(${partnerConversions.commissionCents}),0)`))
    .limit(5);

  return {
    newApplications,
    approved,
    newConversions: conv.count,
    grossCents: conv.gross,
    commissionBookedCents: conv.commission,
    commissionEarnedCents,
    paidCents,
    activeAffiliates,
    earnedUnpaidCents,
    paidToDateCents,
    topAffiliates,
  };
}
