// Subscriptions page — SaaS / tools spend ledger.

import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { desc, asc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { SubscriptionsPageClient } from "@/components/subscriptions/subscriptions-page-client";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  await requireAuth();

  const rows = await db
    .select()
    .from(subscriptions)
    .where(isNull(subscriptions.archivedAt))
    .orderBy(desc(subscriptions.isStarred), asc(subscriptions.name));

  return (
    <SubscriptionsPageClient
      initialRows={rows.map((r) => ({
        id: r.id,
        externalId: r.externalId,
        name: r.name,
        serviceName: r.serviceName,
        ownerEmail: r.ownerEmail,
        isStarred: r.isStarred,
        websiteUrl: r.websiteUrl,
        departments: r.departments,
        inOnePassword: r.inOnePassword,
        // numeric → string from PG; normalise to number | null for the client
        monthlyCostUsd: r.monthlyCostUsd != null ? Number(r.monthlyCostUsd) : null,
        annualCostUsd: r.annualCostUsd != null ? Number(r.annualCostUsd) : null,
        renewalDate: r.renewalDate, // already 'yyyy-mm-dd' or null
        renewalDayOfMonth: r.renewalDayOfMonth,
        notes: r.notes,
        tag: r.tag,
        status: r.status,
        parentId: r.parentId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))}
    />
  );
}
