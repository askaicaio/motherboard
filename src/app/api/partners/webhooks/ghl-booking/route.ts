// =============================================================
// POST /api/partners/webhooks/ghl-booking
// =============================================================
// Inbound webhook for GHL/LeadConnector "Appointment booked".
//
// When an affiliate sends a prospect through /r, the ref code rides in as
// utm_content and GHL captures it onto the contact's attribution. A GHL
// workflow ("Appointment booked" → POST here) forwards the booking so the
// affiliate gets credit. A booking has no money, so we record a
// `direct_intro` attribution event keyed on the prospect's email (via the
// shared recordAffiliateLead helper) rather than a conversion. When the
// sales-led deal later closes, tier-3 email-match attribution finds this
// event and credits the affiliate.
//
// Auth: shared secret in the `X-Webhook-Secret` header (or `?secret=`),
// compared in constant time against GHL_WEBHOOK_SECRET.
//
// Response contract (mirrors the campaign webhook): always 200 on a
// well-formed call so GHL stops retrying — including when we can't credit
// the booking. Only a bad secret returns 401.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { recordAffiliateLead } from "@/lib/partners/lead-attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Constant-time shared-secret check via the X-Webhook-Secret HEADER only —
 * never a query param, which would leak the long-lived secret into access/CDN
 * logs. Fails closed everywhere unless explicitly running local dev with no
 * secret configured (so a preview/staging deploy against a real DB can't
 * silently accept anonymous attribution writes).
 */
function secretOk(req: NextRequest): boolean {
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV === "development";
  const got = req.headers.get("x-webhook-secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Pull the first non-empty string value for any of the given keys. */
function pick(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!secretOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Tolerant parse — GHL payload shapes vary by workflow config.
  let payload: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // fall through with empty payload → skipped below
  }

  // Contact may be nested under `contact` / `full_contact`.
  const contact =
    (payload.contact as Record<string, unknown> | undefined) ??
    (payload.full_contact as Record<string, unknown> | undefined) ??
    payload;
  const attribution = payload.attribution as Record<string, unknown> | undefined;
  const appt = payload.appointment as Record<string, unknown> | undefined;

  // First-rollout forensics: log the SHAPE (top-level keys only, no PII/values)
  // so the extractor can be aligned to the real GHL body if a field is missed.
  console.info(
    "[ghl-booking] keys:",
    Object.keys(payload).join(","),
    "| contact keys:",
    contact && contact !== payload ? Object.keys(contact).join(",") : "(inline)",
  );

  const email =
    pick(payload, "email", "contact_email") ?? pick(contact, "email");
  const refCode =
    pick(payload, "utm_content", "utmContent", "affCode", "aff_id") ??
    pick(contact, "utm_content", "utmContent") ??
    pick(attribution, "utm_content", "utmContent");
  const joinedName = [
    pick(contact, "first_name", "firstName"),
    pick(contact, "last_name", "lastName"),
  ]
    .filter(Boolean)
    .join(" ");
  const name =
    pick(payload, "full_name", "name") ??
    pick(contact, "full_name", "name") ??
    (joinedName || null);
  const company =
    pick(payload, "company", "companyName") ??
    pick(contact, "company", "companyName");

  // Anchor recordedAt on when the booking was CREATED, never the (future)
  // scheduled slot time (startTime): recordedAt is both the first-attribution
  // anchor and the input to isDirectIntroValid, so a future timestamp would
  // wrongly invalidate the intro and mis-order first-attribution-wins.
  const createdRaw =
    pick(payload, "dateAdded", "date_added", "createdAt", "created_at") ??
    pick(contact, "dateAdded", "date_added") ??
    pick(appt, "dateAdded", "createdAt");

  // Stable id for atomic replay dedup (reschedules re-fire the workflow).
  const appointmentId =
    pick(payload, "appointmentId", "appointment_id") ??
    pick(appt, "id", "appointmentId");

  // The scheduled slot time — for the affiliate "leads in progress" aging only
  // (NOT the attribution anchor, which stays the creation time above).
  const startRaw =
    pick(payload, "startTime", "start_time") ??
    pick(appt, "startTime", "start_time");

  const result = await recordAffiliateLead({
    refCode,
    email,
    prospectName: name,
    company,
    recordedAt: createdRaw ? new Date(createdRaw) : null,
    type: "direct_intro",
    sourceDetail: "ghl_appointment",
    externalRef: appointmentId ? `ghl_appt:${appointmentId}` : null,
    scheduledAt: startRaw ? new Date(startRaw) : null,
  });

  return NextResponse.json({ ok: true, ...result });
}
