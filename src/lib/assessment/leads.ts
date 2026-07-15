// =============================================================
// AI Readiness assessment leads — server-side fetch helper
// =============================================================
// The leads live in the separate quiz app (assessment.chiefaiofficer.com),
// exposed at GET /api/leads. We authenticate server-to-server with a shared
// token (X-Leads-Token) so the secret never reaches the browser. The token
// grants the 'all' scope (every lead, both CAIO + Scaling Up editions).
//
// Env:
//   ASSESSMENT_LEADS_TOKEN  — required; must match LEADS_API_TOKEN on the quiz app
//   ASSESSMENT_LEADS_URL    — optional override of the upstream endpoint
// =============================================================

import "server-only";

export interface LeadAnswer {
  question: string;
  answer: string;
}

export interface AssessmentLead {
  id: string;
  email: string;
  subscribedAt: string;
  name: string;
  company: string;
  role: string;
  industry: string;
  companySize: string;
  tier: string; // Explorer | Adopter | Leader | ''
  pct: string; // "0".."100" | ''
  pdfUrl: string;
  edition: string; // 'scaling-up' | 'caio' | ''
  groups: string[];
  utmSource: string;
  utmCampaign: string;
  referer: string;
  primaryGoal: string;
  biggestChallenge: string;
  aiTools: string;
  answers: LeadAnswer[];
  // Booking signal from GHL (who booked a call — Dani's 1:1 / CAIO exec briefing).
  bookedCall?: boolean;
  bookedAt?: string;
  bookedCalendar?: string;
}

interface LeadsPayload {
  leads: AssessmentLead[];
  count: number;
  scope: string;
  fetchedAt: string;
}

export type LeadsResult =
  | ({ ok: true } & LeadsPayload)
  | { ok: false; error: string };

const UPSTREAM_URL =
  process.env.ASSESSMENT_LEADS_URL ||
  "https://assessment.chiefaiofficer.com/api/leads";

export async function fetchAssessmentLeads(): Promise<LeadsResult> {
  const token = process.env.ASSESSMENT_LEADS_TOKEN;
  if (!token) {
    console.error(
      "[assessment-leads] ASSESSMENT_LEADS_TOKEN is not configured",
    );
    return { ok: false, error: "not_configured" };
  }

  try {
    const res = await fetch(UPSTREAM_URL, {
      method: "GET",
      headers: { "X-Leads-Token": token, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[assessment-leads] upstream ${res.status}:`, detail.slice(0, 300));
      return { ok: false, error: `upstream_${res.status}` };
    }

    const data = (await res.json()) as LeadsPayload;
    return {
      ok: true,
      leads: Array.isArray(data.leads) ? data.leads : [],
      count: data.count ?? 0,
      scope: data.scope ?? "all",
      fetchedAt: data.fetchedAt ?? new Date().toISOString(),
    };
  } catch (err) {
    console.error("[assessment-leads] fetch threw:", err);
    return { ok: false, error: "fetch_failed" };
  }
}
