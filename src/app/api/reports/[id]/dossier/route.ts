import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { inngest } from "@/lib/inngest/client";
import { eq } from "drizzle-orm";

const uploadDossierSchema = z.object({
  /** The dossier markdown content */
  content: z.string().min(500).max(200_000),
  /**
   * If true, also kick off Stage 2 (slide distillation) immediately.
   * If false, just save the dossier and let the operator click
   * "Run Deep Research" later to trigger distillation.
   */
  runDistillation: z.boolean().default(true),
});

/**
 * POST /api/reports/[id]/dossier
 *
 * Manually upload a research dossier for a report. Skips Stage 1 entirely.
 * Useful when:
 *   - Operator has Claude Pro and ran research outside of Motherboard
 *   - Operator has an existing dossier from a previous engagement
 *   - Cost / time savings — avoid the $3-5 Stage 1 spend
 *
 * The uploaded dossier replaces any existing dossier on the report.
 * If runDistillation=true, immediately enqueues Stage 2 via Inngest.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = uploadDossierSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const [report] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Save the dossier and reset research state so Stage 2 can run
  await db
    .update(companyReports)
    .set({
      researchDossier: body.content,
      // If we're going straight to distillation, mark as running so the UI
      // shows progress. Otherwise just save and stay idle.
      researchStatus: body.runDistillation ? "running" : "complete",
      researchPhase: body.runDistillation ? "distilling" : null,
      researchError: null,
      researchStartedAt: body.runDistillation ? new Date() : report.researchStartedAt,
      // Mark the dossier as "manual" provider so usage tracking is honest
      researchProvider: "manual_upload",
      // Reset Stage 2 outputs since we're (potentially) about to regenerate them
      researchMarkdown: body.runDistillation ? null : report.researchMarkdown,
      updatedAt: new Date(),
    })
    .where(eq(companyReports.id, id));

  await audit({
    action: "report_research_started",
    actorId: user.id,
    actorEmail: user.email!,
    details: {
      reportId: id,
      source: "manual_upload",
      dossierLength: body.content.length,
      runDistillation: body.runDistillation,
    },
  });

  // Kick off Stage 2 only — Inngest function will detect existing dossier and skip Stage 1
  if (body.runDistillation) {
    await inngest.send({
      name: "report/research.requested",
      data: {
        reportId: id,
        actorId: user.id,
        actorEmail: user.email!,
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: body.runDistillation
      ? "Dossier saved. Stage 2 (slide distillation) running in background."
      : "Dossier saved.",
  });
}
