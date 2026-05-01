import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [report] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  return NextResponse.json({ report });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [existing] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  await db.delete(companyReports).where(eq(companyReports.id, id));

  await audit({
    action: "report_deleted",
    actorId: user.id,
    actorEmail: user.email!,
    details: { reportId: id, companyName: existing.companyName },
  });

  return NextResponse.json({ ok: true });
}
