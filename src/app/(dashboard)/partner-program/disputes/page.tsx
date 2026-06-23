// Partner Program — disputes queue. Server component fetches the queue
// (dispute LEFT JOIN partner) then hands off to the interactive client.

import { db } from "@/lib/db";
import { partnerDisputes, partners } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { DisputesClient } from "@/components/partner-program/disputes-client";

export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  await requireAuth();

  const rows = await db
    .select({
      id: partnerDisputes.id,
      partnerId: partnerDisputes.partnerId,
      partnerName: partners.name,
      partnerEmail: partners.email,
      conversionId: partnerDisputes.conversionId,
      submittedAt: partnerDisputes.submittedAt,
      dealCloseDate: partnerDisputes.dealCloseDate,
      evidence: partnerDisputes.evidence,
      status: partnerDisputes.status,
      resolution: partnerDisputes.resolution,
      decidedAt: partnerDisputes.decidedAt,
    })
    .from(partnerDisputes)
    .leftJoin(partners, eq(partnerDisputes.partnerId, partners.id))
    .orderBy(desc(partnerDisputes.submittedAt));

  return (
    <DisputesClient
      initialDisputes={rows.map((d) => ({
        id: d.id,
        partnerId: d.partnerId,
        partnerName: d.partnerName,
        partnerEmail: d.partnerEmail,
        conversionId: d.conversionId,
        submittedAt: d.submittedAt.toISOString(),
        dealCloseDate: d.dealCloseDate ? d.dealCloseDate.toISOString() : null,
        evidence: d.evidence,
        status: d.status,
        resolution: d.resolution,
        decidedAt: d.decidedAt ? d.decidedAt.toISOString() : null,
      }))}
    />
  );
}
