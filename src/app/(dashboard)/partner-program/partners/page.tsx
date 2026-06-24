// Partners management page — server component fetches all partners (plus a
// per-affiliate paid-payout tally) then hands off to a client component for
// the interactive table + dialogs.

import { db } from "@/lib/db";
import { partners, partnerConversions } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { PartnersClient } from "@/components/partner-program/partners-client";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  await requireAuth();

  // Per-partner paid tally: sum of paid commission cents and a count of
  // DISTINCT payout batches the affiliate has been paid in. One grouped
  // subquery joined back to partners keeps this to a single round-trip.
  const paidTally = db
    .select({
      partnerId: partnerConversions.partnerId,
      paidCents:
        sql<number>`COALESCE(SUM(${partnerConversions.commissionCents}), 0)`.as(
          "paid_cents",
        ),
      payoutCount:
        sql<number>`COUNT(DISTINCT ${partnerConversions.payoutBatchId})`.as(
          "payout_count",
        ),
    })
    .from(partnerConversions)
    .where(eq(partnerConversions.status, "paid"))
    .groupBy(partnerConversions.partnerId)
    .as("paid_tally");

  const rows = await db
    .select({
      id: partners.id,
      refCode: partners.refCode,
      name: partners.name,
      email: partners.email,
      company: partners.company,
      status: partners.status,
      taxFormStatus: partners.taxFormStatus,
      payoutMethod: partners.payoutMethod,
      payoutDetails: partners.payoutDetails,
      ghlContactId: partners.ghlContactId,
      notes: partners.notes,
      isSample: partners.isSample,
      country: partners.country,
      city: partners.city,
      state: partners.state,
      postalCode: partners.postalCode,
      dateOfBirth: partners.dateOfBirth,
      audienceSize: partners.audienceSize,
      applicationData: partners.applicationData,
      taxFormUrl: partners.taxFormUrl,
      appliedAt: partners.appliedAt,
      approvedAt: partners.approvedAt,
      declinedAt: partners.declinedAt,
      declineReason: partners.declineReason,
      portalLastLoginAt: partners.portalLastLoginAt,
      createdAt: partners.createdAt,
      updatedAt: partners.updatedAt,
      // Tally fields (null when the affiliate has no paid conversions).
      paidCents: paidTally.paidCents,
      payoutCount: paidTally.payoutCount,
    })
    .from(partners)
    .leftJoin(paidTally, eq(paidTally.partnerId, partners.id))
    .orderBy(desc(partners.createdAt));

  // Referral link base — read env directly in the server component and
  // pass the resolved base down to the client.
  const base = (
    process.env.PARTNER_PROGRAM_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://chiefaiofficer.com"
  ).replace(/\/$/, "");

  return (
    <PartnersClient
      initialPartners={rows.map((p) => ({
        id: p.id,
        refCode: p.refCode,
        name: p.name,
        email: p.email,
        company: p.company,
        status: p.status,
        taxFormStatus: p.taxFormStatus,
        payoutMethod: p.payoutMethod,
        payoutDetails: p.payoutDetails,
        ghlContactId: p.ghlContactId,
        notes: p.notes,
        isSample: p.isSample,
        country: p.country,
        city: p.city,
        state: p.state,
        postalCode: p.postalCode,
        // `date` columns come back as "YYYY-MM-DD" strings already.
        dateOfBirth: p.dateOfBirth,
        audienceSize: p.audienceSize,
        applicationData: (p.applicationData ?? {}) as Record<string, unknown>,
        taxFormUrl: p.taxFormUrl,
        appliedAt: p.appliedAt ? p.appliedAt.toISOString() : null,
        approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
        declinedAt: p.declinedAt ? p.declinedAt.toISOString() : null,
        declineReason: p.declineReason,
        portalLastLoginAt: p.portalLastLoginAt
          ? p.portalLastLoginAt.toISOString()
          : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        paidCents: Number(p.paidCents ?? 0),
        payoutCount: Number(p.payoutCount ?? 0),
      }))}
      baseUrl={base}
    />
  );
}
