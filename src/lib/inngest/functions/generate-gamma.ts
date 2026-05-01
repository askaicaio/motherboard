// =============================================================
// Durable Gamma generation function
// =============================================================
// Submits the slide markdown to Gamma's Generate API and polls
// until the deck is ready. Each poll is a separate step.run()
// so we never time out.
// =============================================================

import { inngest } from "../client";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { eq } from "drizzle-orm";
import { generateGammaDeck } from "@/lib/reports/gamma-client";

export const generateGammaFn = inngest.createFunction(
  {
    id: "generate-gamma",
    name: "Generate Gamma Deck",
    retries: 1,
    triggers: [{ event: "report/gamma.requested" }],
  },
  async ({ event, step }) => {
    const { reportId, actorId, actorEmail } = event.data;

    // ---- Load report ----
    const report = await step.run("load-report", async () => {
      const [r] = await db
        .select()
        .from(companyReports)
        .where(eq(companyReports.id, reportId))
        .limit(1);
      if (!r) throw new Error(`Report ${reportId} not found`);
      if (!r.researchMarkdown) {
        throw new Error("Report has no slide markdown — research must complete first");
      }
      return r;
    });

    // ---- Mark gamma as running ----
    await step.run("mark-running", async () => {
      await db
        .update(companyReports)
        .set({
          gammaStatus: "running",
          gammaStartedAt: new Date(),
          gammaError: null,
          updatedAt: new Date(),
        })
        .where(eq(companyReports.id, reportId));
    });

    // ---- Submit to Gamma + poll until done (durable, no timeout) ----
    const result = await step.run("generate-gamma-deck", async () => {
      return await generateGammaDeck({
        markdown: report.researchMarkdown!,
        companyName: report.companyName,
      });
    });

    if (!result.success) {
      await step.run("mark-failed", async () => {
        await db
          .update(companyReports)
          .set({
            gammaStatus: "failed",
            gammaError: result.error,
            updatedAt: new Date(),
          })
          .where(eq(companyReports.id, reportId));

        await audit({
          action: "report_gamma_failed",
          actorId,
          actorEmail,
          details: { reportId, error: result.error },
        });
      });
      throw new Error(`Gamma generation failed: ${result.error}`);
    }

    // ---- Mark gamma complete ----
    await step.run("mark-complete", async () => {
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
        .where(eq(companyReports.id, reportId));

      await audit({
        action: "report_gamma_completed",
        actorId,
        actorEmail,
        details: {
          reportId,
          generationId: result.generationId,
          url: result.url,
          provider: result.provider,
        },
      });
    });

    return { reportId, success: true, url: result.url };
  },
);
