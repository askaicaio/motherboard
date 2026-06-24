// Partner Program — unified "Events" pipeline. Server component fetches the
// three datasets (conversions ledger, attribution events, payout batches)
// plus the partner/program lists for the manual-entry and record-intro
// actions, then hands off to the interactive EventsClient.

import { db } from "@/lib/db";
import {
  partnerConversions,
  partnerAttributionEvents,
  partnerPayoutBatches,
  partners,
  partnerPrograms,
} from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { EventsClient } from "@/components/partner-program/events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  await requireAuth();

  // (a) Conversions ledger — newest first, limit 500.
  const conversionRows = await db
    .select({
      id: partnerConversions.id,
      partnerId: partnerConversions.partnerId,
      partnerName: partners.name,
      partnerRefCode: partners.refCode,
      attributionEventId: partnerConversions.attributionEventId,
      buyerEmail: partnerConversions.buyerEmail,
      programId: partnerConversions.programId,
      programName: partnerPrograms.name,
      grossCents: partnerConversions.grossCents,
      feesCents: partnerConversions.feesCents,
      nonCommissionableCents: partnerConversions.nonCommissionableCents,
      commissionableCents: partnerConversions.commissionableCents,
      commissionCents: partnerConversions.commissionCents,
      currency: partnerConversions.currency,
      externalOrderId: partnerConversions.externalOrderId,
      source: partnerConversions.source,
      purchasedAt: partnerConversions.purchasedAt,
      isNewCustomer: partnerConversions.isNewCustomer,
      status: partnerConversions.status,
      refundWindowEndsAt: partnerConversions.refundWindowEndsAt,
      disputeWindowEndsAt: partnerConversions.disputeWindowEndsAt,
      earnedAt: partnerConversions.earnedAt,
      rejectReason: partnerConversions.rejectReason,
      publicRejectReason: partnerConversions.publicRejectReason,
      createdAt: partnerConversions.createdAt,
    })
    .from(partnerConversions)
    .leftJoin(partners, eq(partnerConversions.partnerId, partners.id))
    .innerJoin(
      partnerPrograms,
      eq(partnerConversions.programId, partnerPrograms.id),
    )
    .orderBy(desc(partnerConversions.createdAt))
    .limit(500);

  // (b) Attribution events — joined to partner names, newest first.
  const attributionRows = await db
    .select({
      id: partnerAttributionEvents.id,
      partnerId: partnerAttributionEvents.partnerId,
      partnerName: partners.name,
      type: partnerAttributionEvents.type,
      prospectEmail: partnerAttributionEvents.prospectEmail,
      prospectName: partnerAttributionEvents.prospectName,
      company: partnerAttributionEvents.company,
      sourceDetail: partnerAttributionEvents.sourceDetail,
      recordedAt: partnerAttributionEvents.recordedAt,
      proposalSentAt: partnerAttributionEvents.proposalSentAt,
      isValid: partnerAttributionEvents.isValid,
      notes: partnerAttributionEvents.notes,
    })
    .from(partnerAttributionEvents)
    .leftJoin(partners, eq(partnerAttributionEvents.partnerId, partners.id))
    .orderBy(desc(partnerAttributionEvents.recordedAt))
    .limit(500);

  // (c) Payout batches — newest first.
  const batchRows = await db
    .select({
      id: partnerPayoutBatches.id,
      periodYyyymm: partnerPayoutBatches.periodYyyymm,
      status: partnerPayoutBatches.status,
      totalCents: partnerPayoutBatches.totalCents,
      generatedAt: partnerPayoutBatches.generatedAt,
      paidAt: partnerPayoutBatches.paidAt,
    })
    .from(partnerPayoutBatches)
    .orderBy(desc(partnerPayoutBatches.generatedAt));

  // Partner + program lists for the action dialogs.
  const partnerList = await db
    .select({ id: partners.id, name: partners.name, refCode: partners.refCode })
    .from(partners)
    .orderBy(partners.name);

  const programList = await db
    .select({
      id: partnerPrograms.id,
      name: partnerPrograms.name,
      salesLed: partnerPrograms.salesLed,
    })
    .from(partnerPrograms)
    .orderBy(partnerPrograms.name);

  return (
    <EventsClient
      initialConversions={conversionRows.map((r) => ({
        id: r.id,
        partnerId: r.partnerId,
        partnerName: r.partnerName,
        partnerRefCode: r.partnerRefCode,
        attributionEventId: r.attributionEventId,
        buyerEmail: r.buyerEmail,
        programId: r.programId,
        programName: r.programName,
        grossCents: Number(r.grossCents),
        feesCents: Number(r.feesCents),
        nonCommissionableCents: Number(r.nonCommissionableCents),
        commissionableCents: Number(r.commissionableCents),
        commissionCents: Number(r.commissionCents),
        currency: r.currency,
        externalOrderId: r.externalOrderId,
        source: r.source,
        purchasedAt: r.purchasedAt ? r.purchasedAt.toISOString() : null,
        isNewCustomer: r.isNewCustomer,
        status: r.status as
          | "pending"
          | "earned"
          | "paid"
          | "reversed"
          | "rejected",
        refundWindowEndsAt: r.refundWindowEndsAt
          ? r.refundWindowEndsAt.toISOString()
          : null,
        disputeWindowEndsAt: r.disputeWindowEndsAt
          ? r.disputeWindowEndsAt.toISOString()
          : null,
        earnedAt: r.earnedAt ? r.earnedAt.toISOString() : null,
        rejectReason: r.rejectReason,
        publicRejectReason: r.publicRejectReason,
        createdAt: r.createdAt.toISOString(),
      }))}
      initialEvents={attributionRows.map((e) => ({
        id: e.id,
        partnerId: e.partnerId,
        partnerName: e.partnerName,
        type: e.type,
        prospectEmail: e.prospectEmail,
        prospectName: e.prospectName,
        company: e.company,
        sourceDetail: e.sourceDetail,
        recordedAt: e.recordedAt.toISOString(),
        proposalSentAt: e.proposalSentAt ? e.proposalSentAt.toISOString() : null,
        isValid: e.isValid,
        notes: e.notes,
      }))}
      initialBatches={batchRows.map((b) => ({
        id: b.id,
        periodYyyymm: b.periodYyyymm,
        status: b.status,
        totalCents: b.totalCents,
        generatedAt: b.generatedAt.toISOString(),
        paidAt: b.paidAt ? b.paidAt.toISOString() : null,
      }))}
      partners={partnerList.map((p) => ({
        id: p.id,
        name: p.name,
        refCode: p.refCode,
      }))}
      programs={programList.map((p) => ({
        id: p.id,
        name: p.name,
        salesLed: p.salesLed,
      }))}
    />
  );
}
