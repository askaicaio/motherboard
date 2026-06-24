// Partners management page — server component fetches all partners then
// hands off to a client component for the interactive table + dialogs.

import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { PartnersClient } from "@/components/partner-program/partners-client";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  await requireAuth();

  const rows = await db
    .select()
    .from(partners)
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
        appliedAt: p.appliedAt ? p.appliedAt.toISOString() : null,
        approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
        declinedAt: p.declinedAt ? p.declinedAt.toISOString() : null,
        declineReason: p.declineReason,
        isSample: p.isSample,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))}
      baseUrl={base}
    />
  );
}
