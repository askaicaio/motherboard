import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { generateResearch } from "@/lib/reports/anthropic-client";
import { inngest } from "@/lib/inngest/client";
import { eq } from "drizzle-orm";

/**
 * POST /api/reports/[id]/research
 *
 * In live mode: enqueues an Inngest event and returns immediately.
 *   The durable Inngest function (researchReportFn) handles the
 *   long-running two-stage Claude calls in the background.
 *
 * In mock mode: runs synchronously since there's nothing to defer.
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

  if (report.researchStatus === "complete") {
    return NextResponse.json(
      { error: "Research already complete. Delete and re-create the report to re-run." },
      { status: 409 },
    );
  }

  if (report.researchStatus === "running") {
    return NextResponse.json(
      { error: "Research is already running. Wait for it to complete or reset it from the UI." },
      { status: 409 },
    );
  }

  const isMockMode =
    process.env.REPORTS_MODE === "mock" || !process.env.ANTHROPIC_API_KEY;

  // Audit + mark as running BEFORE enqueueing/running so the UI shows
  // "Running" status immediately
  await db
    .update(companyReports)
    .set({
      researchStatus: "running",
      researchPhase: "researching",
      researchStartedAt: new Date(),
      researchError: null,
      updatedAt: new Date(),
    })
    .where(eq(companyReports.id, id));

  await audit({
    action: "report_research_started",
    actorId: user.id,
    actorEmail: user.email!,
    details: { reportId: id, companyName: report.companyName, mode: isMockMode ? "mock" : "live" },
  });

  // ============================================================
  // Mock mode: run synchronously (no Inngest needed)
  // ============================================================
  if (isMockMode) {
    const result = await generateResearch({
      companyName: report.companyName,
      industry: report.industry || undefined,
      knownDetails: report.knownDetails || undefined,
      titleFormat: report.titleFormat,
    });

    if (result.success) {
      await db
        .update(companyReports)
        .set({
          researchStatus: "complete",
          researchPhase: null,
          researchCompletedAt: new Date(),
          researchDossier: result.dossier,
          researchMarkdown: result.slideMarkdown,
          researchModel: result.model,
          researchProvider: result.provider,
          researchSources: result.sources,
          researchInputTokens: result.usage.inputTokens,
          researchOutputTokens: result.usage.outputTokens,
          researchCacheReadTokens: result.usage.cacheReadTokens,
          researchCacheCreationTokens: result.usage.cacheCreationTokens,
          researchWebSearchCount: result.usage.webSearchRequests,
          researchCostUsd: result.usage.estimatedCostUsd.toFixed(4),
          researchThinkingSummary: result.thinkingSummary || null,
          updatedAt: new Date(),
        })
        .where(eq(companyReports.id, id));
    } else {
      await db
        .update(companyReports)
        .set({
          researchStatus: "failed",
          researchPhase: null,
          researchError: result.error,
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
  // Live mode: enqueue Inngest event and return immediately
  // ============================================================
  await inngest.send({
    name: "report/research.requested",
    data: {
      reportId: id,
      actorId: user.id,
      actorEmail: user.email!,
    },
  });

  return NextResponse.json({
    success: true,
    mode: "live",
    message: "Research enqueued — running in background",
  });
}
