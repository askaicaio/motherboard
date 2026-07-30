// =============================================================
// Affiliate lead attribution — shared ingest for "lead signal" webhooks
// =============================================================
// A booked call (GHL) and a completed AI-readiness quiz are both LEAD
// signals, not sales. They don't create commission (that only happens on a
// real purchase via ingestConversion). Instead they record a
// `partner_attribution_events` row keyed on the prospect's email, so that
// when the sales-led deal later closes, tier-3 email-match attribution
// (see src/lib/partners/ingest.ts) links the sale back to the affiliate.
//
// This is the same write the staff "Record direct introduction" action
// performs (src/app/api/partners/attribution/route.ts) — centralised here
// so the booking + quiz webhooks stay thin and behave identically.
// =============================================================

import { db } from "@/lib/db";
import { partnerAttributionEvents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getPartnerByRefCode } from "@/lib/partners/queries";

export type LeadAttributionResult =
  | { status: "skipped"; reason: "missing_email_or_refcode" | "unknown_or_ineligible_partner" }
  | { status: "deduped"; eventId: string; partnerId: string }
  | { status: "created"; eventId: string; partnerId: string };

export interface RecordAffiliateLeadInput {
  /** Affiliate ref code (rides in via utm_content from /r). */
  refCode: string | null | undefined;
  /** Prospect email — the join key for later email-match attribution. */
  email: string | null | undefined;
  prospectName?: string | null;
  company?: string | null;
  /** First-attribution anchor. Defaults to now. */
  recordedAt?: Date | null;
  /**
   * `direct_intro` survives long sales cycles (validated only by
   * proposal_sent_at). `tracked_link` is subject to the 60-day cookie
   * window in tier-3 matching — use it only for short self-serve funnels.
   */
  type: "direct_intro" | "tracked_link";
  /** Free-form provenance, e.g. "ghl_appointment" or "ai_readiness_quiz". */
  sourceDetail: string;
  /** For a booked call, the scheduled appointment time (drives "in progress"). */
  scheduledAt?: Date | null;
  /**
   * Stable id of the originating external event (GHL appointment id, quiz
   * submission id). When present, dedup is atomic via the external_ref unique
   * index — a replay can't create a duplicate even under a concurrent race.
   * When absent, we fall back to a best-effort (partner, email, type) check.
   */
  externalRef?: string | null;
}

/**
 * Resolve refCode → partner, gate on approved/active, dedup by
 * (partner, email, type, valid), then insert a system attribution event.
 * Never throws on business-rule misses — returns a typed skip so callers
 * can respond 200 (webhooks must not make the sender retry).
 */
export async function recordAffiliateLead(
  input: RecordAffiliateLeadInput,
): Promise<LeadAttributionResult> {
  const email = input.email?.toLowerCase().trim();
  const refCode = input.refCode?.trim();

  if (!email || !refCode) {
    return { status: "skipped", reason: "missing_email_or_refcode" };
  }

  const partner = await getPartnerByRefCode(refCode);
  if (!partner || !["approved", "active"].includes(partner.status)) {
    return { status: "skipped", reason: "unknown_or_ineligible_partner" };
  }

  const externalRef = input.externalRef?.trim() || null;

  // Best-effort dedup when there's no external id to key on. Deliberately does
  // NOT filter is_valid — an event an admin explicitly invalidated must still
  // suppress a webhook replay, so revoked credit isn't silently resurrected.
  // (When externalRef IS present, the unique index below is the real guard.)
  if (!externalRef) {
    const [dupe] = await db
      .select({ id: partnerAttributionEvents.id })
      .from(partnerAttributionEvents)
      .where(
        and(
          eq(partnerAttributionEvents.partnerId, partner.id),
          eq(partnerAttributionEvents.prospectEmail, email),
          eq(partnerAttributionEvents.type, input.type),
        ),
      )
      .limit(1);
    if (dupe) {
      return { status: "deduped", eventId: dupe.id, partnerId: partner.id };
    }
  }

  const recordedAt =
    input.recordedAt && !Number.isNaN(input.recordedAt.getTime())
      ? input.recordedAt
      : new Date();

  // Atomic dedup on externalRef via the unique index — race-proof against
  // concurrent replays. onConflictDoNothing only fires when a target is given.
  const insert = db.insert(partnerAttributionEvents).values({
    partnerId: partner.id,
    type: input.type,
    prospectEmail: email,
    prospectName: input.prospectName?.trim() || null,
    company: input.company?.trim() || null,
    sourceDetail: input.sourceDetail,
    recordedAt,
    proposalSentAt: null,
    isValid: true,
    externalRef,
    scheduledAt:
      input.scheduledAt && !Number.isNaN(input.scheduledAt.getTime())
        ? input.scheduledAt
        : null,
    createdBy: null,
  });

  const [event] = externalRef
    ? await insert
        .onConflictDoNothing({ target: partnerAttributionEvents.externalRef })
        .returning()
    : await insert.returning();

  // Conflict on externalRef → the row already exists (a concurrent/earlier
  // replay won). Return it as a dedup rather than a spurious failure.
  if (!event) {
    const [existing] = await db
      .select({ id: partnerAttributionEvents.id })
      .from(partnerAttributionEvents)
      .where(eq(partnerAttributionEvents.externalRef, externalRef!))
      .limit(1);
    if (existing) {
      return { status: "deduped", eventId: existing.id, partnerId: partner.id };
    }
    return { status: "skipped", reason: "unknown_or_ineligible_partner" };
  }

  return { status: "created", eventId: event.id, partnerId: partner.id };
}
