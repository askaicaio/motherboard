// Partner Program — Conversions queue. Server component fetches the
// conversion rows (joined to partner + program) plus the partner/program
// lists for manual entry + matching, then hands off to a client component.

import { db } from "@/lib/db";
import {
  partnerConversions,
  partners,
  partnerPrograms,
} from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ConversionsClient } from "@/components/partner-program/conversions-client";

export const dynamic = "force-dynamic";

export default async function ConversionsPage() {
  await requireAuth();

  const rows = await db
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
    <ConversionsClient
      initialRows={rows.map((r) => ({
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
