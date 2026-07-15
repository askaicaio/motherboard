// Same-origin proxy for the AI Readiness assessment leads. The client Leads
// page fetches THIS route; the handler holds the shared token server-side and
// forwards to the quiz app, so the secret never reaches the browser.
//
// Auth-gated: the token is powerful (reads every lead), so this must never be
// callable anonymously.

import { NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import { fetchAssessmentLeads } from "@/lib/assessment/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await fetchAssessmentLeads();
  if (!result.ok) {
    const status = result.error === "not_configured" ? 503 : 502;
    return NextResponse.json(
      {
        error:
          result.error === "not_configured"
            ? "Leads integration is not configured (missing ASSESSMENT_LEADS_TOKEN)."
            : "Could not load leads from the assessment app.",
      },
      { status },
    );
  }

  return NextResponse.json({
    leads: result.leads,
    count: result.count,
    fetchedAt: result.fetchedAt,
  });
}
