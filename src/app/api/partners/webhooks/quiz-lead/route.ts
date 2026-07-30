// =============================================================
// POST /api/partners/webhooks/quiz-lead
// =============================================================
// Inbound webhook the AI-Readiness Assessment app calls when someone
// completes the quiz. When the lead carries an affiliate ref code (read
// from ?aff_id / utm_content on the quiz landing page and persisted through
// the flow), we record a `tracked_link` attribution event keyed on the
// prospect's email — so a later self-serve purchase credits the affiliate
// via tier-3 email-match attribution.
//
// A quiz completion is a lead signal, not a sale — no conversion/commission
// is created here (that only happens on a real purchase).
//
// Auth: the SAME shared token used for the read-side leads proxy — header
// `X-Leads-Token` compared in constant time against ASSESSMENT_LEADS_TOKEN
// (matches LEADS_API_TOKEN on the quiz app). One secret, both directions.
//
// Response: always 200 on a well-formed body (silently skips when there's
// no ref code or the partner is unknown/ineligible); 401 on a bad token.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { recordAffiliateLead } from "@/lib/partners/lead-attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Constant-time token check via the X-Leads-Token header. Fails closed
 * everywhere unless explicitly running local dev with no token configured.
 */
function tokenOk(req: NextRequest): boolean {
  const expected = process.env.ASSESSMENT_LEADS_TOKEN;
  if (!expected) return process.env.NODE_ENV === "development";
  const got = req.headers.get("x-leads-token") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const schema = z.object({
  email: z.string().email().max(200),
  // Accept either an explicit affiliate code or the raw utm_content it rode in on.
  refCode: z.string().max(64).nullable().optional(),
  affiliateCode: z.string().max(64).nullable().optional(),
  utmContent: z.string().max(64).nullable().optional(),
  name: z.string().max(200).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  edition: z.string().max(64).nullable().optional(),
  submittedAt: z.string().nullable().optional(), // ISO datetime
  // Stable submission id for atomic replay dedup, if the quiz app sends one.
  submissionId: z.string().max(128).nullable().optional(),
});

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = schema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const refCode = body.refCode || body.affiliateCode || body.utmContent || null;
  const submittedAt = body.submittedAt ? new Date(body.submittedAt) : null;
  const sourceDetail = body.edition
    ? `ai_readiness_quiz:${body.edition}`
    : "ai_readiness_quiz";

  // `tracked_link`: quiz→purchase is a short self-serve funnel, so the 60-day
  // cookie window in tier-3 matching is appropriate here.
  const result = await recordAffiliateLead({
    refCode,
    email: body.email,
    prospectName: body.name,
    company: body.company,
    recordedAt: submittedAt,
    type: "tracked_link",
    sourceDetail,
    externalRef: body.submissionId ? `quiz:${body.submissionId}` : null,
  });

  return NextResponse.json({ ok: true, ...result });
}
