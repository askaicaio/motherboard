import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

/**
 * POST /api/reports/[id]/archive
 * Soft-delete: marks the report as archived but keeps it in the database.
 * Archived reports show up in the "View archived" tab and can be restored
 * or permanently deleted.
 *
 * Body: { unarchive?: boolean } — if true, restores from archive instead.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { unarchive?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — defaults to archive
  }

  const [report] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (body.unarchive) {
    // Restore from archive
    await db
      .update(companyReports)
      .set({
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(companyReports.id, id));

    await audit({
      action: "report_unarchived",
      actorId: user.id,
      actorEmail: user.email!,
      details: { reportId: id, companyName: report.companyName },
    });

    return NextResponse.json({ ok: true, archived: false });
  }

  // Archive
  await db
    .update(companyReports)
    .set({
      archivedAt: new Date(),
      archivedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(companyReports.id, id));

  await audit({
    action: "report_archived",
    actorId: user.id,
    actorEmail: user.email!,
    details: { reportId: id, companyName: report.companyName },
  });

  return NextResponse.json({ ok: true, archived: true });
}
