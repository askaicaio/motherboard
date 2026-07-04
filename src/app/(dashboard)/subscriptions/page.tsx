// Subscriptions page — SaaS / tools spend ledger.

import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { desc, asc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { SubscriptionsPageClient } from "@/components/subscriptions/subscriptions-page-client";

export const dynamic = "force-dynamic";

// Department tags we no longer surface. "Unique Account Needed" is retired —
// individual accounts are modeled as child credential rows now. Stripped here
// so it disappears immediately, even before migration 0028 cleans the data.
const HIDDEN_DEPARTMENTS = new Set(["unique account needed"]);
function visibleDepartments(depts: string[]): string[] {
  return depts.filter((d) => !HIDDEN_DEPARTMENTS.has(d.trim().toLowerCase()));
}

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
        label: r.label,
        isStarred: r.isStarred,
        websiteUrl: r.websiteUrl,
        departments: visibleDepartments(r.departments),
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
