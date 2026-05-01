import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { generateResearch } from "@/lib/reports/anthropic-client";
import { eq } from "drizzle-orm";

// Allow up to 5 minutes for the research call (Vercel Pro max)
export const maxDuration = 300;

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load the report
  const [report] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Don't double-run if already completed (require explicit re-run)
  if (report.researchStatus === "complete") {
    return NextResponse.json(
      { error: "Research already complete. Delete and re-create the report to re-run." },
      { status: 409 },
    );
  }

  // Mark as running, clear any old dossier/markdown from a previous failed run
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
    details: { reportId: id, companyName: report.companyName },
  });

  // Run research with phase + dossier callbacks so the UI can poll for progress
  const result = await generateResearch({
    companyName: report.companyName,
    industry: report.industry || undefined,
    knownDetails: report.knownDetails || undefined,
    titleFormat: report.titleFormat,
    onPhaseChange: async (phase) => {
      await db
        .update(companyReports)
        .set({ researchPhase: phase, updatedAt: new Date() })
        .where(eq(companyReports.id, id));
    },
    onDossierReady: async (dossier) => {
      // Persist dossier the moment Stage 1 finishes — survives Stage 2 failures
      await db
        .update(companyReports)
        .set({ researchDossier: dossier, updatedAt: new Date() })
        .where(eq(companyReports.id, id));
    },
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

    await audit({
      action: "report_research_completed",
      actorId: user.id,
      actorEmail: user.email!,
      details: {
        reportId: id,
        provider: result.provider,
        model: result.model,
        dossierLength: result.dossier.length,
        slideMarkdownLength: result.slideMarkdown.length,
        sourceCount: result.sources.length,
        webSearches: result.usage.webSearchRequests,
        costUsd: result.usage.estimatedCostUsd,
      },
    });
  } else {
    // If stage 1 succeeded but stage 2 failed, preserve the dossier so
    // the operator can re-run just the distillation later.
    await db
      .update(companyReports)
      .set({
        researchStatus: "failed",
        researchPhase: null,
        researchError: result.error,
        ...(result.partialDossier
          ? { researchDossier: result.partialDossier }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(companyReports.id, id));

    await audit({
      action: "report_research_failed",
      actorId: user.id,
      actorEmail: user.email!,
      details: {
        reportId: id,
        error: result.error,
        partialDossierSaved: !!result.partialDossier,
      },
    });

    return NextResponse.json(
      { error: result.error, success: false },
      { status: 500 },
    );
  }

  // Return the updated report
  const [updated] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);

  return NextResponse.json({ report: updated, success: true });
}
