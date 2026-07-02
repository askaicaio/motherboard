// POST /api/lead — PUBLIC, no auth required.
// Lead capture for the roadmap.chiefaiofficer.com event landing page.
//
// Validates the JSON payload, then runs TWO INDEPENDENT operations with
// Promise.allSettled so one failing never blocks the other — we NEVER drop the
// email:
//   1) Send the "Four Stages of AI Adoption" roadmap via Resend.
//   2) Upsert the contact into GoHighLevel (dedupe on email).
//
// Contract: returns { ok: true } (200) whenever the request is well-formed
// (the client always shows the on-page download link), even if one or both
// sub-ops fail. Only a missing/invalid email returns 400. Never 500s uncaught.

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const leadSchema = z.object({
  email: z.string().email().max(300),
  firstName: z.string().max(150).optional(),
  lastName: z.string().max(150).optional(),
  utm_source: z.string().max(300).optional(),
  utm_medium: z.string().max(300).optional(),
  utm_campaign: z.string().max(300).optional(),
  utm_content: z.string().max(300).optional(),
  utm_term: z.string().max(300).optional(),
});

type Lead = z.infer<typeof leadSchema>;

// --- (1) Send the roadmap email via Resend ---------------------------------
async function sendRoadmapEmail(email: string, firstName?: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const pdfUrl = process.env.NEXT_PUBLIC_ROADMAP_PDF_URL || "/four-stages-roadmap.pdf";

  if (!apiKey || apiKey === "re_your_api_key") {
    // Development / unconfigured: log instead of sending.
    console.log(`[lead] Would send roadmap email to ${email} (link: ${pdfUrl})`);
    return;
  }

  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <p style="font-size: 16px; line-height: 1.5;">${greeting}</p>
      <p style="font-size: 16px; line-height: 1.5;">
        Thanks for your interest in the <strong>Four Stages of AI Adoption</strong> roadmap.
        It's the same framework we use with executives to move from experimentation to
        enterprise-wide AI leverage — here's your copy.
      </p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${pdfUrl}"
           style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 600;">
          Download the roadmap
        </a>
      </p>
      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        If the button doesn't work, copy and paste this link into your browser:<br />
        <a href="${pdfUrl}" style="color: #2563eb;">${pdfUrl}</a>
      </p>
      <p style="font-size: 14px; line-height: 1.5; color: #475569; margin-top: 24px;">
        — The Chief AI Officer team
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Chief AI Officer <roadmap@send.chiefaiofficer.com>",
      to: [email],
      subject: "Your Four Stages of AI Adoption roadmap",
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend API error: ${response.status} ${detail}`);
  }
}

// --- (2) Upsert the contact into GoHighLevel -------------------------------
async function upsertGhlContact(lead: Lead): Promise<void> {
  const pit = process.env.GHL_PIT;

  // Be defensive: if the private integration token is missing, skip gracefully.
  if (!pit) {
    console.warn("[lead] GHL_PIT not configured — skipping GHL upsert.");
    return;
  }

  const locationId = process.env.GHL_LOCATION_ID || "N6W24Fhx5bOKo4FFKAiv";

  // NOTE: GHL custom fields may need the field ID instead of the plain `key`.
  // If these entries are silently ignored, GET the field metadata:
  //   GET https://services.leadconnectorhq.com/locations/{locationId}/customFields
  //   Headers: Authorization: `Bearer ${GHL_PIT}`, Version: "2021-07-28"
  // Each field returns { id, fieldKey, ... }; switch each entry below from
  // { key, field_value } to { id, field_value } using the matching id.
  const body = {
    locationId,
    email: lead.email,
    firstName: lead.firstName,
    lastName: lead.lastName,
    source: "Live Event – Roadmap Page",
    tags: ["live-event", "roadmap-download"],
    customFields: [
      { key: "lead_source", field_value: "Live Event" },
      { key: "campaign", field_value: lead.utm_campaign || "unspecified" },
      { key: "utm_source", field_value: lead.utm_source || "" },
      { key: "utm_medium", field_value: lead.utm_medium || "" },
      { key: "referral_date", field_value: new Date().toISOString() },
      { key: "landing_page", field_value: "roadmap.chiefaiofficer.com" },
    ],
  };

  const response = await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pit}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GHL upsert error: ${response.status} ${detail}`);
  }
}

export async function POST(request: NextRequest) {
  // --- Parse + validate JSON ---
  let lead: Lead;
  try {
    const json = await request.json();
    lead = leadSchema.parse(json);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "A valid email address is required." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = lead.email.toLowerCase();

  // --- Run both ops independently; one failing never blocks the other ---
  try {
    const results = await Promise.allSettled([
      sendRoadmapEmail(email, lead.firstName),
      upsertGhlContact({ ...lead, email }),
    ]);

    const [emailResult, ghlResult] = results;
    if (emailResult.status === "rejected") {
      console.error("[lead] Roadmap email failed:", emailResult.reason);
    }
    if (ghlResult.status === "rejected") {
      console.error("[lead] GHL upsert failed:", ghlResult.reason);
    }
  } catch (err) {
    // Should never hit this (allSettled doesn't reject), but stay bulletproof.
    console.error("[lead] Unexpected error running lead ops:", err);
  }

  // The client always shows the on-page download link regardless of sub-op
  // outcomes, so a well-formed request is always a 200 { ok: true }.
  return NextResponse.json({ ok: true });
}
