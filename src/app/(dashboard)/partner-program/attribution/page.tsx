// Partner attribution events log — server component fetches the events
// (joined to partner names) plus the eligible partners for the
// "record direct introduction" form, then hands off to a client table.

import { db } from "@/lib/db";
import { partnerAttributionEvents, partners } from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { AttributionClient } from "@/components/partner-program/attribution-client";

export const dynamic = "force-dynamic";

export default async function AttributionPage() {
  await requireAuth();

  const rows = await db
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

  // Partners eligible to be credited with a direct intro.
  const partnerRows = await db
    .select({
      id: partners.id,
      name: partners.name,
      refCode: partners.refCode,
    })
    .from(partners)
    .where(inArray(partners.status, ["approved", "active"]))
    .orderBy(partners.name);

  return (
    <AttributionClient
      initialEvents={rows.map((e) => ({
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
      partners={partnerRows.map((p) => ({
        id: p.id,
        name: p.name,
        refCode: p.refCode,
      }))}
    />
  );
}
