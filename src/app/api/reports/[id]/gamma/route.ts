import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { generateGammaDeck } from "@/lib/reports/gamma-client";
import { inngest } from "@/lib/inngest/client";
import { eq } from "drizzle-orm";

/**
 * POST /api/reports/[id]/gamma
 *
 * Live mode: enqueues Inngest event for durable Gamma generation
 * Mock mode: runs synchronously
 */
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

  if (report.gammaStatus === "running") {
    return NextResponse.json(
      { error: "Gamma generation is already running." },
      { status: 409 },
    );
  }

  const isMockMode =
    process.env.REPORTS_MODE === "mock" || !process.env.GAMMA_API_KEY;

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
    details: { reportId: id, companyName: report.companyName, mode: isMockMode ? "mock" : "live" },
  });

  // ============================================================
  // Mock mode: run synchronously
  // ============================================================
  if (isMockMode) {
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
          gammaCreditsDeducted: result.creditsDeducted ?? null,
          gammaCreditsRemaining: result.creditsRemaining ?? null,
          updatedAt: new Date(),
        })
        .where(eq(companyReports.id, id));
    } else {
      await db
        .update(companyReports)
        .set({
          gammaStatus: "failed",
          gammaError: result.error,
          updatedAt: new Date(),
        })
        .where(eq(companyReports.id, id));
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const [updated] = await db
      .select()
      .from(companyReports)
      .where(eq(companyReports.id, id))
      .limit(1);
    return NextResponse.json({ report: updated, success: true, mode: "mock" });
  }

  // ============================================================
  // Live mode: enqueue Inngest event
  // ============================================================
  await inngest.send({
    name: "report/gamma.requested",
    data: {
      reportId: id,
      actorId: user.id,
      actorEmail: user.email!,
    },
  });

  return NextResponse.json({
    success: true,
    mode: "live",
    message: "Gamma generation enqueued — running in background",
  });
}
