import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyReports } from "@/lib/db/schema";
import { audit } from "@/lib/audit/logger";
import { getOptionalAuth } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

/**
 * POST /api/reports/[id]/reset
 *
 * Manually reset a stuck "running" job to "failed" so it can be retried.
 * Useful when the Vercel function timed out (5 min on Pro, 60s on Hobby)
 * but the DB still shows status = running.
 *
 * Body: { stage: "research" | "gamma" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { stage?: "research" | "gamma" } = {};
  try {
    body = await request.json();
  } catch {
    /* default body */
  }

  const stage = body.stage || "research";

  const [report] = await db
    .select()
    .from(companyReports)
    .where(eq(companyReports.id, id))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (stage === "research") {
    if (report.researchStatus !== "running") {
      return NextResponse.json(
        { error: `Research is not running (status: ${report.researchStatus}); nothing to reset.` },
        { status: 409 },
      );
    }

    await db
      .update(companyReports)
      .set({
        researchStatus: "failed",
        researchPhase: null,
        researchError:
          "Reset by operator — likely server-side timeout (Vercel function exceeded 5 min). Click Retry to try again.",
        updatedAt: new Date(),
      })
      .where(eq(companyReports.id, id));

    await audit({
      action: "report_research_failed",
      actorId: user.id,
      actorEmail: user.email!,
      details: {
        reportId: id,
        reason: "manual_reset",
        previousPhase: report.researchPhase,
      },
    });
  } else {
    if (report.gammaStatus !== "running") {
      return NextResponse.json(
        { error: `Gamma is not running (status: ${report.gammaStatus}); nothing to reset.` },
        { status: 409 },
      );
    }

    await db
      .update(companyReports)
      .set({
        gammaStatus: "failed",
        gammaError:
          "Reset by operator — likely server-side timeout. Click Retry to try again.",
        updatedAt: new Date(),
      })
      .where(eq(companyReports.id, id));

    await audit({
      action: "report_gamma_failed",
      actorId: user.id,
      actorEmail: user.email!,
      details: { reportId: id, reason: "manual_reset" },
    });
  }

  return NextResponse.json({ ok: true });
}
