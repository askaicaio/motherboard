import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ReportDetailClient } from "./report-detail-client";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [report] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);

  if (!report) notFound();

  return <ReportDetailClient initialReport={report} />;
}
