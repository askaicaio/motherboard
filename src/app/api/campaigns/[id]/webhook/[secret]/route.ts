// =============================================================
// Campaign webhook ingestion endpoint
// =============================================================
// External systems (primarily GHL Workflow's "Webhook" action) POST
// here when a campaign event fires. This endpoint:
//   1. Authenticates via the per-campaign secret in the URL path
//   2. Parses the payload (handles GHL, Zoom, and generic JSON shapes)
//   3. Upserts the person by email — deduped across all campaigns
//   4. Upserts the campaign_lead row (one per campaign × person)
//   5. Appends a campaign_event with the full raw payload
//   6. Advances the lead's journey_stage if the event implies it
//
// Event type is selected via ?event=<type> query string. Default: signup.
// Recognized: signup | attended | no_show | discovery_call_booked | custom
//
// Always returns 200 (even on parse errors) so the upstream system
// doesn't retry forever — we log the error and store the raw payload
// for forensic review. Returns 401 / 404 only when the URL itself is bad.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignPeople,
  campaignLeads,
  campaignEvents,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
// Allow a generous compute window — GHL may bundle large payloads
export const maxDuration = 30;

// -------- Payload extraction helpers ------------------------------------
// GHL outbound webhook payloads vary heavily by workflow config. We try
// a list of likely keys and fall back gracefully.
function pickString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNested(
  obj: Record<string, unknown>,
  path: string[],
): string | null {
  let cur: unknown = obj;
  for (const segment of path) {
    if (cur && typeof cur === "object" && segment in (cur as object)) {
      cur = (cur as Record<string, unknown>)[segment];
    } else {
      return null;
    }
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : null;
}

interface ExtractedLead {
  email: string | null;
  name: string | null;
  phone: string | null;
  ghlContactId: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referer: string | null;
}

function extract(payload: unknown, request: NextRequest): ExtractedLead {
  const obj =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  // GHL nests contact data under various keys depending on workflow setup
  const nested =
    (obj.contact as Record<string, unknown>) ||
    (obj.full_contact as Record<string, unknown>) ||
    obj;

  const email =
    pickString(obj, "email", "contact_email") ||
    pickString(nested, "email", "contact_email");

  const firstName =
    pickString(obj, "first_name", "firstName") ||
    pickString(nested, "first_name", "firstName");
  const lastName =
    pickString(obj, "last_name", "lastName") ||
    pickString(nested, "last_name", "lastName");
  const fullName =
    pickString(obj, "full_name", "name", "fullName") ||
    pickString(nested, "full_name", "name", "fullName");
  const name =
    fullName ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    null;

  const phone =
    pickString(obj, "phone", "phone_number", "phoneNumber") ||
    pickString(nested, "phone", "phone_number", "phoneNumber");

  const ghlContactId =
    pickString(obj, "contact_id", "contactId", "id", "ghl_contact_id") ||
    pickString(nested, "contact_id", "contactId", "id", "ghl_contact_id");

  // UTM params arrive in many shapes — top-level, nested under "attribution"
  // or "tracking", or buried in customFields. Try the obvious ones.
  const utmSource =
    pickString(obj, "utm_source", "utmSource") ||
    pickNested(obj, ["attribution", "utm_source"]) ||
    pickNested(obj, ["tracking", "utm_source"]);
  const utmMedium =
    pickString(obj, "utm_medium", "utmMedium") ||
    pickNested(obj, ["attribution", "utm_medium"]) ||
    pickNested(obj, ["tracking", "utm_medium"]);
  const utmCampaign =
    pickString(obj, "utm_campaign", "utmCampaign") ||
    pickNested(obj, ["attribution", "utm_campaign"]) ||
    pickNested(obj, ["tracking", "utm_campaign"]);
  const utmContent =
    pickString(obj, "utm_content", "utmContent") ||
    pickNested(obj, ["attribution", "utm_content"]) ||
    pickNested(obj, ["tracking", "utm_content"]);
  const utmTerm =
    pickString(obj, "utm_term", "utmTerm") ||
    pickNested(obj, ["attribution", "utm_term"]) ||
    pickNested(obj, ["tracking", "utm_term"]);

  const source =
    pickString(obj, "source", "lead_source", "leadSource") ||
    pickNested(obj, ["attribution", "source"]) ||
    utmSource ||
    null;

  const referer =
    pickString(obj, "referer", "referrer", "page_url", "pageUrl") ||
    pickNested(obj, ["attribution", "referrer"]) ||
    request.headers.get("referer") ||
    null;

  return {
    email,
    name,
    phone,
    ghlContactId,
    source,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    referer,
  };
}

// Map event-type query param → resulting lead journey_stage.
// Stages are ordered; later stages override earlier ones, never regress.
const STAGE_ORDER = [
  "registered",
  "attended",
  "no_show",
  "booked_call",
  "customer",
] as const;
type Stage = (typeof STAGE_ORDER)[number];
function stageRank(s: string): number {
  const i = STAGE_ORDER.indexOf(s as Stage);
  return i < 0 ? -1 : i;
}

const EVENT_TO_STAGE: Record<string, Stage | null> = {
  signup: "registered",
  attended: "attended",
  no_show: "no_show",
  discovery_call_booked: "booked_call",
  customer: "customer",
  custom: null, // doesn't move the journey forward
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; secret: string }> },
) {
  const { id, secret } = await params;

  // ---- Resolve + authenticate the campaign --------------------------------
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.webhookSecret !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }
  if (campaign.archivedAt) {
    return NextResponse.json(
      { error: "Campaign is archived" },
      { status: 410 },
    );
  }

  // ---- Determine event type from query string -----------------------------
  const eventTypeParam = request.nextUrl.searchParams.get("event") || "signup";
  const eventType = eventTypeParam.toLowerCase();
  const targetStage = EVENT_TO_STAGE[eventType] ?? null;

  // ---- Parse the body — tolerate non-JSON, malformed, or empty ------------
  let payload: unknown = null;
  try {
    const text = await request.text();
    if (text) payload = JSON.parse(text);
  } catch {
    // Leave payload = null; we'll still record what we have
  }

  const lead = extract(payload, request);

  // Without an email we can't dedupe / link a person. Still log the event
  // so the user can see the inbound traffic in the campaign's raw log.
  if (!lead.email) {
    await db.insert(campaignEvents).values({
      campaignId: campaign.id,
      eventType,
      eventData: { error: "No email in payload" },
      rawPayload: payload as object,
    });
    return NextResponse.json(
      { ok: true, warning: "No email — event logged without lead association" },
      { status: 200 },
    );
  }

  const emailNormalized = lead.email.toLowerCase();

  // ---- Upsert person ------------------------------------------------------
  let [person] = await db
    .select()
    .from(campaignPeople)
    .where(eq(campaignPeople.email, emailNormalized))
    .limit(1);

  if (!person) {
    [person] = await db
      .insert(campaignPeople)
      .values({
        email: emailNormalized,
        name: lead.name,
        phone: lead.phone,
        ghlContactId: lead.ghlContactId,
        lastActivityAt: new Date(),
      })
      .returning();
  } else {
    // Backfill blanks but never overwrite existing values
    const patch: Partial<typeof campaignPeople.$inferInsert> = {
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    };
    if (!person.name && lead.name) patch.name = lead.name;
    if (!person.phone && lead.phone) patch.phone = lead.phone;
    if (!person.ghlContactId && lead.ghlContactId)
      patch.ghlContactId = lead.ghlContactId;
    await db
      .update(campaignPeople)
      .set(patch)
      .where(eq(campaignPeople.id, person.id));
  }

  // ---- Upsert campaign_lead row -------------------------------------------
  let [leadRow] = await db
    .select()
    .from(campaignLeads)
    .where(
      and(
        eq(campaignLeads.campaignId, campaign.id),
        eq(campaignLeads.personId, person.id),
      ),
    )
    .limit(1);

  const stagePatch: Partial<typeof campaignLeads.$inferInsert> = {};
  if (targetStage && (!leadRow || stageRank(targetStage) > stageRank(leadRow.journeyStage))) {
    stagePatch.journeyStage = targetStage;
    if (targetStage === "attended") stagePatch.attendedAt = new Date();
    if (targetStage === "booked_call") stagePatch.bookedCallAt = new Date();
  }

  if (!leadRow) {
    [leadRow] = await db
      .insert(campaignLeads)
      .values({
        campaignId: campaign.id,
        personId: person.id,
        source: lead.source,
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        utmCampaign: lead.utmCampaign,
        utmContent: lead.utmContent,
        utmTerm: lead.utmTerm,
        referer: lead.referer,
        journeyStage: targetStage ?? "registered",
        registeredAt: new Date(),
        attendedAt: stagePatch.attendedAt ?? null,
        bookedCallAt: stagePatch.bookedCallAt ?? null,
      })
      .returning();
  } else {
    // Backfill source/UTM if missing; don't clobber existing attribution
    const patch: Partial<typeof campaignLeads.$inferInsert> = {
      ...stagePatch,
      updatedAt: new Date(),
    };
    if (!leadRow.source && lead.source) patch.source = lead.source;
    if (!leadRow.utmSource && lead.utmSource) patch.utmSource = lead.utmSource;
    if (!leadRow.utmMedium && lead.utmMedium) patch.utmMedium = lead.utmMedium;
    if (!leadRow.utmCampaign && lead.utmCampaign)
      patch.utmCampaign = lead.utmCampaign;
    if (!leadRow.utmContent && lead.utmContent)
      patch.utmContent = lead.utmContent;
    if (!leadRow.utmTerm && lead.utmTerm) patch.utmTerm = lead.utmTerm;
    if (!leadRow.referer && lead.referer) patch.referer = lead.referer;
    await db
      .update(campaignLeads)
      .set(patch)
      .where(eq(campaignLeads.id, leadRow.id));
  }

  // ---- Append event log row -----------------------------------------------
  await db.insert(campaignEvents).values({
    campaignId: campaign.id,
    leadId: leadRow.id,
    personId: person.id,
    eventType,
    eventData: {
      email: emailNormalized,
      name: lead.name,
      source: lead.source,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
    },
    rawPayload: payload as object,
  });

  return NextResponse.json({
    ok: true,
    eventType,
    personId: person.id,
    leadId: leadRow.id,
  });
}

// Some upstream systems probe with GET first — return a friendly OK
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; secret: string }> },
) {
  const { id, secret } = await params;
  const [campaign] = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  // Don't reveal whether the secret is valid via GET — just confirm endpoint exists
  return NextResponse.json({
    ok: true,
    campaign: campaign.name,
    hint: "POST a JSON body to ingest a campaign event. ?event=signup|attended|no_show|discovery_call_booked",
    secretLen: secret.length,
  });
}
