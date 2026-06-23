// Partner Program — marketing resources manager (staff).
import { db } from "@/lib/db";
import { partnerResources } from "@/lib/db/schema";
import { asc, desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ResourcesAdminClient } from "@/components/partner-program/resources-admin-client";

export const dynamic = "force-dynamic";

export default async function PartnerResourcesPage() {
  await requireAuth();

  const rows = await db
    .select()
    .from(partnerResources)
    .where(isNull(partnerResources.archivedAt))
    .orderBy(asc(partnerResources.sortOrder), desc(partnerResources.createdAt));

  return (
    <ResourcesAdminClient
      initialResources={rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        fileUrl: r.fileUrl,
        externalUrl: r.externalUrl,
        fileName: r.fileName,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        isPublic: r.isPublic,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
