// =============================================================
// Campaign ↔ GHL sync — pull contacts by tag and upsert into motherboard
// =============================================================
// Mirrors the webhook upsert logic (see app/api/campaigns/[id]/webhook/...)
// so the shape of campaign_people / campaign_leads / campaign_events
// stays consistent regardless of which path created the row.
//
// Idempotent: re-running on the same set produces 0 changes if nothing
// in GHL changed. Stages can only advance, never regress.
// =============================================================

import { db } from "@/lib/db";
import {
  campaigns,
  campaignPeople,
  campaignLeads,
  campaignEvents,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  searchContactsByTag,
  firstAttribution,
  bestEmail,
  bestName,
  type GHLContact,
} from "./ghl-client";

export interface SyncResult {
  ok: boolean;
  campaignId: string;
  tag: string;
  totalFromGhl: number;
  newPeople: number;
  newLeads: number;
  updatedLeads: number;
  durationMs: number;
  error?: string;
}

/**
 * Sync one campaign with its configured GHL tag.
 * No-op (returns ok:true with zero counts) if the campaign has no tag.
 */
export async function syncCampaignFromGhl(
  campaignId: string,
): Promise<SyncResult> {
  const start = Date.now();

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    return {
      ok: false,
      campaignId,
      tag: "",
      totalFromGhl: 0,
      newPeople: 0,
      newLeads: 0,
      updatedLeads: 0,
      durationMs: Date.now() - start,
      error: "Campaign not found",
    };
  }
  if (!campaign.ghlTag) {
    return {
      ok: true,
      campaignId,
      tag: "",
      totalFromGhl: 0,
      newPeople: 0,
      newLeads: 0,
      updatedLeads: 0,
      durationMs: Date.now() - start,
    };
  }

  // Mark in-progress so concurrent crons don't double-sync
  await db
    .update(campaigns)
    .set({ ghlLastSyncStatus: "in_progress", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  let result: SyncResult;
  try {
    const { contacts, total } = await searchContactsByTag(campaign.ghlTag);

    let newPeople = 0;
    let newLeads = 0;
    let updatedLeads = 0;

    for (const contact of contacts) {
      const counters = await upsertContact(campaign.id, contact);
      newPeople += counters.newPerson ? 1 : 0;
      newLeads += counters.newLead ? 1 : 0;
      updatedLeads += counters.updatedLead ? 1 : 0;
    }

    result = {
      ok: true,
      campaignId,
      tag: campaign.ghlTag,
      totalFromGhl: total,
      newPeople,
      newLeads,
      updatedLeads,
      durationMs: Date.now() - start,
    };

    await db
      .update(campaigns)
      .set({
        ghlLastSyncedAt: new Date(),
        ghlLastSyncStatus: "success",
        ghlLastSyncCount: contacts.length,
        ghlLastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GHL sync] Campaign ${campaignId} failed:`, message);
    result = {
      ok: false,
      campaignId,
      tag: campaign.ghlTag,
      totalFromGhl: 0,
      newPeople: 0,
      newLeads: 0,
      updatedLeads: 0,
      durationMs: Date.now() - start,
      error: message,
    };

    await db
      .update(campaigns)
      .set({
        ghlLastSyncedAt: new Date(),
        ghlLastSyncStatus: "failed",
        ghlLastSyncError: message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
  }

  return result;
}

/**
 * Upsert one GHL contact as a person + lead for the given campaign.
 * Returns flags so the caller can tally counts.
 */
async function upsertContact(
  campaignId: string,
  contact: GHLContact,
): Promise<{ newPerson: boolean; newLead: boolean; updatedLead: boolean }> {
  const email = bestEmail(contact);
  if (!email) {
    // Without an email we have nothing to dedupe on — skip silently
    return { newPerson: false, newLead: false, updatedLead: false };
  }

  const name = bestName(contact);
  const attribution = firstAttribution(contact);
  const dateAdded = contact.dateAdded ? new Date(contact.dateAdded) : null;

  // ---- Upsert person ----
  let [person] = await db
    .select()
    .from(campaignPeople)
    .where(eq(campaignPeople.email, email))
    .limit(1);

  let newPerson = false;
  if (!person) {
    [person] = await db
      .insert(campaignPeople)
      .values({
        email,
        name,
        phone: contact.phone ?? null,
        ghlContactId: contact.id,
        lastActivityAt: dateAdded ?? new Date(),
      })
      .returning();
    newPerson = true;
  } else {
    const patch: Partial<typeof campaignPeople.$inferInsert> = {
      lastActivityAt: dateAdded ?? new Date(),
      updatedAt: new Date(),
    };
    if (!person.name && name) patch.name = name;
    if (!person.phone && contact.phone) patch.phone = contact.phone;
    if (!person.ghlContactId) patch.ghlContactId = contact.id;
    await db
      .update(campaignPeople)
      .set(patch)
      .where(eq(campaignPeople.id, person.id));
  }

  // ---- Upsert lead ----
  let [leadRow] = await db
    .select()
    .from(campaignLeads)
    .where(
      and(
        eq(campaignLeads.campaignId, campaignId),
        eq(campaignLeads.personId, person.id),
      ),
    )
    .limit(1);

  let newLead = false;
  let updatedLead = false;

  if (!leadRow) {
    [leadRow] = await db
      .insert(campaignLeads)
      .values({
        campaignId,
        personId: person.id,
        source: contact.source ?? attribution?.sessionSource ?? null,
        utmSource: attribution?.utmSource ?? null,
        utmMedium: attribution?.utmMedium ?? null,
        utmCampaign: attribution?.utmCampaign ?? null,
        utmContent: attribution?.utmContent ?? null,
        utmTerm: attribution?.utmTerm ?? null,
        referer: attribution?.referrer ?? attribution?.url ?? null,
        journeyStage: "registered",
        registeredAt: dateAdded ?? new Date(),
      })
      .returning();
    newLead = true;

    // Append a "signup" event so the activity log reflects the import
    await db.insert(campaignEvents).values({
      campaignId,
      leadId: leadRow.id,
      personId: person.id,
      eventType: "signup",
      eventData: {
        email,
        name,
        source: "ghl_sync",
        utmSource: attribution?.utmSource ?? null,
        utmMedium: attribution?.utmMedium ?? null,
        utmCampaign: attribution?.utmCampaign ?? null,
        ghlContactId: contact.id,
      },
      rawPayload: contact as unknown as object,
      occurredAt: dateAdded ?? new Date(),
    });
  } else {
    // Backfill any missing attribution
    const patch: Partial<typeof campaignLeads.$inferInsert> = {
      updatedAt: new Date(),
    };
    let touched = false;
    if (!leadRow.source && (contact.source || attribution?.sessionSource)) {
      patch.source = contact.source ?? attribution?.sessionSource ?? null;
      touched = true;
    }
    if (!leadRow.utmSource && attribution?.utmSource) {
      patch.utmSource = attribution.utmSource;
      touched = true;
    }
    if (!leadRow.utmMedium && attribution?.utmMedium) {
      patch.utmMedium = attribution.utmMedium;
      touched = true;
    }
    if (!leadRow.utmCampaign && attribution?.utmCampaign) {
      patch.utmCampaign = attribution.utmCampaign;
      touched = true;
    }
    if (!leadRow.utmContent && attribution?.utmContent) {
      patch.utmContent = attribution.utmContent;
      touched = true;
    }
    if (!leadRow.utmTerm && attribution?.utmTerm) {
      patch.utmTerm = attribution.utmTerm;
      touched = true;
    }
    if (!leadRow.referer && (attribution?.referrer || attribution?.url)) {
      patch.referer = attribution.referrer ?? attribution.url ?? null;
      touched = true;
    }
    if (touched) {
      await db
        .update(campaignLeads)
        .set(patch)
        .where(eq(campaignLeads.id, leadRow.id));
      updatedLead = true;
    }
  }

  return { newPerson, newLead, updatedLead };
}
