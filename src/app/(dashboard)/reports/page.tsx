import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { desc, isNull, isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ReportsListPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";

  // Run both queries in parallel
  const [reports, archivedCountRows] = await Promise.all([
    db
      .select()
      .from(companyReports)
      .where(
        showArchived
          ? isNotNull(companyReports.archivedAt)
          : isNull(companyReports.archivedAt),
      )
      .orderBy(desc(companyReports.createdAt))
      .limit(500),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(companyReports)
      .where(isNotNull(companyReports.archivedAt)),
  ]);

  const archivedCount = archivedCountRows[0]?.count ?? 0;

  return (
    <ReportsPageClient
      initialReports={reports}
      initialArchived={showArchived}
      archivedCount={archivedCount}
    />
  );
}
