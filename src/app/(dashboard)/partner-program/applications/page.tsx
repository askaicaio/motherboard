import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ApplicationsClient } from "@/components/partner-program/applications-client";

export const dynamic = "force-dynamic";

export default async function PartnerApplicationsPage() {
  await requireAuth();

  const rows = await db
    .select({
      id: partners.id,
      name: partners.name,
      email: partners.email,
      company: partners.company,
      notes: partners.notes,
      appliedAt: partners.appliedAt,
      taxFormUrl: partners.taxFormUrl,
    })
    .from(partners)
    .where(eq(partners.status, "applied"))
    .orderBy(asc(partners.appliedAt));

  return (
    <ApplicationsClient
      initialApplications={rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        company: r.company ?? null,
        notes: r.notes ?? null,
        appliedAt: r.appliedAt.toISOString(),
        hasTaxForm: !!r.taxFormUrl,
      }))}
    />
  );
}
