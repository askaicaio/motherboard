// Partner Program — Payouts page. Server component lists the existing
// payout batches then hands off to the interactive client for preview /
// generate / mark-paid / export. The money math lives behind the
// /api/partners/payouts/* endpoints — this page only reads the batch log.

import { db } from "@/lib/db";
import { partnerPayoutBatches } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { PayoutsClient } from "@/components/partner-program/payouts-client";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  await requireAuth();

  const rows = await db
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

  return (
    <PayoutsClient
      initialBatches={rows.map((b) => ({
        id: b.id,
        periodYyyymm: b.periodYyyymm,
        status: b.status,
        totalCents: b.totalCents,
        generatedAt: b.generatedAt.toISOString(),
        paidAt: b.paidAt ? b.paidAt.toISOString() : null,
      }))}
    />
  );
}
