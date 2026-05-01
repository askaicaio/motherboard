import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { generateGammaDeck } from "@/lib/reports/gamma-client";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

export async function POST(
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

  if (report.researchStatus !== "complete" || !report.researchMarkdown) {
    return NextResponse.json(
      { error: "Research must be complete before generating Gamma deck." },
      { status: 409 },
    );
  }

  if (report.gammaStatus === "complete" && report.gammaUrl) {
    return NextResponse.json(
      { error: "Gamma deck already generated.", url: report.gammaUrl },
      { status: 409 },
    );
  }

  // Mark as running
  await db
    .update(companyReports)
    .set({
      gammaStatus: "running",
      gammaStartedAt: new Date(),
      gammaError: null,
      updatedAt: new Date(),
    })
    .where(eq(companyReports.id, id));

  await audit({
    action: "report_gamma_started",
    actorId: user.id,
    actorEmail: user.email!,
    details: { reportId: id, companyName: report.companyName },
  });

  const result = await generateGammaDeck({
    markdown: report.researchMarkdown,
    companyName: report.companyName,
  });

  if (result.success) {
    await db
      .update(companyReports)
      .set({
        gammaStatus: "complete",
        gammaCompletedAt: new Date(),
        gammaGenerationId: result.generationId,
        gammaUrl: result.url,
        updatedAt: new Date(),
      })
      .where(eq(companyReports.id, id));

    await audit({
      action: "report_gamma_completed",
      actorId: user.id,
      actorEmail: user.email!,
      details: {
        reportId: id,
        generationId: result.generationId,
        url: result.url,
        provider: result.provider,
      },
    });
  } else {
    await db
      .update(companyReports)
      .set({
        gammaStatus: "failed",
        gammaError: result.error,
        updatedAt: new Date(),
      })
      .where(eq(companyReports.id, id));

    await audit({
      action: "report_gamma_failed",
      actorId: user.id,
      actorEmail: user.email!,
      details: { reportId: id, error: result.error },
    });

    return NextResponse.json(
      { error: result.error, success: false },
      { status: 500 },
    );
  }

  const [updated] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);

  return NextResponse.json({ report: updated, success: true });
}
