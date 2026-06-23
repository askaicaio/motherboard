// =============================================================
// Partner Program — conversion ingestion (the source-agnostic core)
// =============================================================
// ONE entry point — ingestConversion — that every adapter (Stripe
// webhook, manual admin entry, future sources) calls. It:
//   1. Resolves the program
//   2. Idempotency-guards on (source, external_order_id) at the DB layer
//   3. Attributes a partner (aff_id → cookie/click → email-match → none)
//   4. Runs the rules (new-customer gate, first-purchase-only)
//   5. Computes commission on the correct basis (Terms §3.3)
//   6. Inserts the conversion + an audit event + upserts customers_index
//
// Reliable attribution depends on aff_id riding through to purchase.
// The email-match fallback is best-effort only (see README).
// =============================================================

import { db } from "@/lib/db";
import {
  partners,
  partnerClicks,
  partnerAttributionEvents,
  partnerConversions,
  partnerConversionEvents,
  customersIndex,
} from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  getActiveSettings,
  getPartnerByRefCode,
  resolveProgram,
  isNewCustomer,
} from "./queries";
import {
  computeCommission,
  computeWindows,
  resolveRate,
  clickWithinWindow,
  pickFirstAttribution,
  isDirectIntroValid,
  type AttributionCandidate,
} from "./rules";

const ELIGIBLE_PARTNER_STATUSES = ["approved", "active"];

export type ConversionSource = "stripe" | "manual" | "clawback";

export interface IngestInput {
  buyerEmail: string;
  /** program id | slug | stripe price id */
  programRef: string;
  grossCents: number;
  feesCents?: number;
  nonCommissionableCents?: number;
  externalOrderId?: string | null;
  source: ConversionSource;
  purchasedAt: Date;
  affId?: string | null;
  cookieId?: string | null;
  stripeSessionId?: string | null;
  stripeChargeId?: string | null;
  /** Currency code, defaults USD. */
  currency?: string;
}

export interface IngestResult {
  ok: boolean;
  conversionId?: string;
  status?: string;
  partnerId?: string | null;
  rejectReason?: string | null;
  /** Set when no conversion was written (e.g. unknown program). */
  error?: string;
  /** True when an existing row was returned (idempotent replay). */
  idempotentReplay?: boolean;
}

/**
 * Resolve which partner (if any) this conversion belongs to, plus the
 * attribution event that justifies it. Order of precedence:
 *   1. aff_id rode through the purchase → direct, authoritative
 *   2. cookie_id maps to a click that's still inside the cookie window
 *   3. email-match against valid attribution events (best-effort)
 */
async function attribute(
  input: IngestInput,
  cookieWindowDays: number,
): Promise<{ partnerId: string | null; attributionEventId: string | null }> {
  // --- 1. aff_id direct match ---
  if (input.affId) {
    const partner = await getPartnerByRefCode(input.affId.trim());
    if (partner && ["approved", "active"].includes(partner.status)) {
      return { partnerId: partner.id, attributionEventId: null };
    }
  }

  // --- 2. cookie_id → click, with age check vs cookie window ---
  if (input.cookieId) {
    const [click] = await db
      .select()
      .from(partnerClicks)
      .where(eq(partnerClicks.cookieId, input.cookieId))
      .orderBy(desc(partnerClicks.createdAt))
      .limit(1);
    if (
      click &&
      clickWithinWindow(click.createdAt, cookieWindowDays, input.purchasedAt)
    ) {
      const [partner] = await db
        .select()
        .from(partners)
        .where(eq(partners.id, click.partnerId))
        .limit(1);
      if (partner && ["approved", "active"].includes(partner.status)) {
        return { partnerId: partner.id, attributionEventId: null };
      }
    }
  }

  // --- 3. email-match against valid attribution events (best-effort) ---
  const email = input.buyerEmail.trim().toLowerCase();
  const events = await db
    .select()
    .from(partnerAttributionEvents)
    .where(
      and(
        eq(partnerAttributionEvents.prospectEmail, email),
        eq(partnerAttributionEvents.isValid, true),
      ),
    );

  // Only events whose owning partner is currently approved/active can win
  // — mirrors tiers 1 & 2. A suspended/terminated partner earns no new
  // commissions even if a stale event still points at them.
  const partnerIds = [...new Set(events.map((e) => e.partnerId))];
  const eligiblePartnerIds = new Set<string>();
  if (partnerIds.length > 0) {
    const rows = await db
      .select({ id: partners.id, status: partners.status })
      .from(partners)
      .where(inArray(partners.id, partnerIds));
    for (const r of rows) {
      if (ELIGIBLE_PARTNER_STATUSES.includes(r.status)) {
        eligiblePartnerIds.add(r.id);
      }
    }
  }

  const candidates: AttributionCandidate[] = events
    .filter((e) => eligiblePartnerIds.has(e.partnerId))
    .filter((e) => {
      if (e.type === "direct_intro") {
        // Playbook §13: a direct_intro only counts if it was logged BEFORE
        // the proposal. Recompute from proposal_sent_at rather than trust
        // the stored is_valid flag (which may be stale/default-true).
        return isDirectIntroValid(e.recordedAt, e.proposalSentAt);
      }
      // tracked_link must be within the cookie window of the purchase.
      return clickWithinWindow(e.recordedAt, cookieWindowDays, input.purchasedAt);
    })
    .map((e) => ({
      id: e.id,
      type: e.type as "tracked_link" | "direct_intro",
      recordedAt: e.recordedAt,
      isValid: e.isValid,
    }));

  const winner = pickFirstAttribution(candidates);
  if (winner) {
    const event = events.find((e) => e.id === winner.id)!;
    return { partnerId: event.partnerId, attributionEventId: event.id };
  }

  return { partnerId: null, attributionEventId: null };
}

export async function ingestConversion(input: IngestInput): Promise<IngestResult> {
  const email = input.buyerEmail.trim().toLowerCase();
  const feesCents = input.feesCents ?? 0;

  // --- Resolve program (required — program_id is NOT NULL) ---
  const program = await resolveProgram(input.programRef);
  if (!program) {
    return {
      ok: false,
      error: `unknown_program: ${input.programRef}`,
    };
  }

  // --- Settings AS OF the purchase instant ---
  const settings = await getActiveSettings(input.purchasedAt);
  if (!settings) {
    return { ok: false, error: "no_active_settings" };
  }

  // non-commissionable = explicit input + program's setup/passthrough fees
  const nonCommissionableCents =
    (input.nonCommissionableCents ?? 0) +
    program.setupFeeCents +
    program.stripeFeePassthroughCents;

  // --- Attribution ---
  const { partnerId, attributionEventId } = await attribute(
    input,
    settings.cookieWindowDays,
  );

  // --- Rules: determine status + reject reason ---
  let status: "pending" | "rejected" = "pending";
  let rejectReason: string | null = null;
  let publicRejectReason: string | null = null;

  // New-customer gate (§3.2) subsumes first-purchase-only (§3.1): a buyer
  // with ANY prior CAIO transaction — including a prior referred purchase —
  // already fails isNewCustomer, so a separate "already_purchased" branch
  // would be unreachable. One gate, one reason.
  const buyerIsNew = await isNewCustomer(email);

  if (!partnerId) {
    status = "rejected";
    rejectReason = "unmatched";
    // public reason intentionally null — admin can match it later
  } else if (!buyerIsNew) {
    status = "rejected";
    rejectReason = "not_new_customer";
    publicRejectReason = "Buyer was an existing CAIO customer.";
  }

  // --- Commission math (always computed for transparency, even on reject) ---
  const rate = resolveRate(program, settings);
  const { commissionableCents, commissionCents } = computeCommission({
    grossCents: input.grossCents,
    feesCents,
    nonCommissionableCents,
    rate,
  });

  const { refundWindowEndsAt, disputeWindowEndsAt } = computeWindows(
    input.purchasedAt,
    settings.refundWindowDays,
  );

  // --- Insert with idempotency guard at the DB layer ---
  const [inserted] = await db
    .insert(partnerConversions)
    .values({
      partnerId: partnerId,
      attributionEventId,
      buyerEmail: email,
      programId: program.id,
      grossCents: input.grossCents,
      feesCents,
      nonCommissionableCents,
      commissionableCents,
      commissionCents,
      currency: input.currency ?? "USD",
      externalOrderId: input.externalOrderId ?? null,
      stripeSessionId: input.stripeSessionId ?? null,
      stripeChargeId: input.stripeChargeId ?? null,
      source: input.source,
      purchasedAt: input.purchasedAt,
      isNewCustomer: buyerIsNew,
      status,
      refundWindowEndsAt,
      disputeWindowEndsAt,
      rejectReason,
      publicRejectReason,
    })
    .onConflictDoNothing({
      target: [partnerConversions.source, partnerConversions.externalOrderId],
    })
    .returning();

  // Idempotent replay: a row with this (source, external_order_id) already
  // existed. Return it without re-processing.
  if (!inserted) {
    const [existing] = await db
      .select()
      .from(partnerConversions)
      .where(
        and(
          eq(partnerConversions.source, input.source),
          input.externalOrderId
            ? eq(partnerConversions.externalOrderId, input.externalOrderId)
            : eq(partnerConversions.buyerEmail, email),
        ),
      )
      .orderBy(desc(partnerConversions.createdAt))
      .limit(1);
    return {
      ok: true,
      conversionId: existing?.id,
      status: existing?.status,
      partnerId: existing?.partnerId ?? null,
      rejectReason: existing?.rejectReason ?? null,
      idempotentReplay: true,
    };
  }

  // --- Audit event ---
  await db.insert(partnerConversionEvents).values({
    conversionId: inserted.id,
    eventType: "ingested",
    fromStatus: null,
    toStatus: status,
    actorEmail: `system:${input.source}`,
    details: {
      affId: input.affId ?? null,
      cookieId: input.cookieId ?? null,
      attributionEventId,
      rate,
      commissionableCents,
      commissionCents,
      rejectReason,
    },
  });

  // --- Keep the new-customer index growing (idempotent) ---
  // A real purchase happened (gross > 0), so this buyer is now a known
  // customer regardless of whether the commission was accepted.
  await db
    .insert(customersIndex)
    .values({
      email,
      firstPurchaseAt: input.purchasedAt,
      source: input.source,
    })
    .onConflictDoNothing({ target: customersIndex.email });

  return {
    ok: true,
    conversionId: inserted.id,
    status,
    partnerId,
    rejectReason,
  };
}
