// Docs directory — curated library of external doc links.

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { DocsPageClient } from "@/components/docs/docs-page-client";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  await requireAuth();

  const rows = await db
    .select()
    .from(documents)
    .where(isNull(documents.archivedAt))
    .orderBy(desc(documents.pinned), desc(documents.createdAt));

  return (
    <DocsPageClient
      initialDocs={rows.map((d) => ({
        id: d.id,
        title: d.title,
        url: d.url,
        description: d.description,
        category: d.category,
        tags: d.tags,
        pinned: d.pinned,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))}
    />
  );
}
