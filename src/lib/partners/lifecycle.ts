// =============================================================
// Partner Program — commission lifecycle transitions
// =============================================================
// Every state change goes through here so it (a) is consistent and
// (b) always writes a partner_conversion_events audit row.
//
//   pending --(refund window passes clean)--> earned
//   pending/earned --(refund in window)----> reversed
//   paid --(refund after window)-----------> reversed + negative clawback row
//   earned --(payout batch marked paid)----> paid
// =============================================================

import { db } from "@/lib/db";
import {
  partnerConversions,
  partnerConversionEvents,
  partnerPayoutBatches,
} from "@/lib/db/schema";
import { and, eq, isNotNull, lte, ne } from "drizzle-orm";

interface Actor {
  actorId?: string | null;
  actorEmail?: string | null;
}

async function recordEvent(
  conversionId: string,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  actor: Actor,
  details: Record<string, unknown> = {},
) {
  await db.insert(partnerConversionEvents).values({
    conversionId,
    eventType,
    fromStatus,
    toStatus,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    details,
  });
}

/**
 * Promote every pending conversion whose refund window has elapsed
 * cleanly to earned. Only positively-commissioned, partner-matched rows
 * are eligible — rejected/unmatched rows never promote. Returns the
 * number promoted.
 */
export async function promotePendingToEarned(now: Date): Promise<number> {
  const due = await db
    .select()
    .from(partnerConversions)
    .where(
      and(
        eq(partnerConversions.status, "pending"),
        lte(partnerConversions.refundWindowEndsAt, now),
        isNotNull(partnerConversions.partnerId),
        ne(partnerConversions.commissionCents, 0),
      ),
    );

  let promoted = 0;
  for (const row of due) {
    await db
      .update(partnerConversions)
      .set({ status: "earned", earnedAt: now, updatedAt: now })
      .where(
        and(
          eq(partnerConversions.id, row.id),
          eq(partnerConversions.status, "pending"),
        ),
      );
    await recordEvent(row.id, "status_changed", "pending", "earned", {
      actorEmail: "system:cron",
    });
    promoted += 1;
  }
  return promoted;
}

/**
 * Reverse a conversion (refund/chargeback within window, or dispute).
 * Idempotent: no-op if already reversed.
 */
export async function reverseConversion(
  conversionId: string,
  reason: string,
  actor: Actor = {},
): Promise<void> {
  const [row] = await db
    .select()
    .from(partnerConversions)
    .where(eq(partnerConversions.id, conversionId))
    .limit(1);
  if (!row || row.status === "reversed") return;

  await db
    .update(partnerConversions)
    .set({ status: "reversed", updatedAt: new Date() })
    .where(eq(partnerConversions.id, conversionId));

  await recordEvent(conversionId, "status_changed", row.status, "reversed", actor, {
    reason,
  });
}

/**
 * A commission that was already PAID is later refunded/charged back. We
 * can't un-pay it, so we book a negative clawback row (status=earned so
 * the next payout batch nets it out) and flip the original to reversed.
 * Returns the new clawback conversion id.
 */
export async function createClawback(
  originalConversionId: string,
  reason: string,
  actor: Actor = {},
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [orig] = await tx
      .select()
      .from(partnerConversions)
      .where(eq(partnerConversions.id, originalConversionId))
      .limit(1);
    if (!orig) return null;

    // Guard: only paid commissions get a clawback. In-window reversals
    // use reverseConversion instead.
    if (orig.status !== "paid") {
      // Already handled elsewhere or not eligible — fall back to a plain reverse.
      await tx
        .update(partnerConversions)
        .set({ status: "reversed", updatedAt: new Date() })
        .where(eq(partnerConversions.id, originalConversionId));
      await tx.insert(partnerConversionEvents).values({
        conversionId: originalConversionId,
        eventType: "status_changed",
        fromStatus: orig.status,
        toStatus: "reversed",
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        details: { reason, note: "reversed without clawback (was not paid)" },
      });
      return null;
    }

    const now = new Date();
    const [clawback] = await tx
      .insert(partnerConversions)
      .values({
        partnerId: orig.partnerId,
        attributionEventId: orig.attributionEventId,
        buyerEmail: orig.buyerEmail,
        programId: orig.programId,
        grossCents: -orig.grossCents,
        feesCents: -orig.feesCents,
        nonCommissionableCents: -orig.nonCommissionableCents,
        commissionableCents: -orig.commissionableCents,
        commissionCents: -orig.commissionCents,
        currency: orig.currency,
        externalOrderId: null, // keeps the partial unique index clear
        source: "clawback",
        purchasedAt: now,
        isNewCustomer: orig.isNewCustomer,
        status: "earned", // nets against future earned rows in the next batch
        refundWindowEndsAt: now,
        disputeWindowEndsAt: now,
        earnedAt: now,
        clawbackOfConversionId: orig.id,
      })
      .returning();

    await tx
      .update(partnerConversions)
      .set({ status: "reversed", updatedAt: now })
      .where(eq(partnerConversions.id, originalConversionId));

    await tx.insert(partnerConversionEvents).values([
      {
        conversionId: orig.id,
        eventType: "status_changed",
        fromStatus: "paid",
        toStatus: "reversed",
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        details: { reason, clawbackId: clawback.id },
      },
      {
        conversionId: clawback.id,
        eventType: "clawback_created",
        fromStatus: null,
        toStatus: "earned",
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        details: { reason, clawbackOf: orig.id, amountCents: -orig.commissionCents },
      },
    ]);

    return clawback.id;
  });
}

/**
 * Mark a payout batch paid: flip every earned conversion in the batch to
 * paid and stamp the batch. Atomic.
 */
export async function markBatchPaid(
  batchId: string,
  actor: Actor = {},
): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: partnerConversions.id, status: partnerConversions.status })
      .from(partnerConversions)
      .where(eq(partnerConversions.payoutBatchId, batchId));

    const now = new Date();
    let flipped = 0;
    for (const row of rows) {
      if (row.status !== "earned") continue;
      await tx
        .update(partnerConversions)
        .set({ status: "paid", updatedAt: now })
        .where(eq(partnerConversions.id, row.id));
      await tx.insert(partnerConversionEvents).values({
        conversionId: row.id,
        eventType: "status_changed",
        fromStatus: "earned",
        toStatus: "paid",
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        details: { batchId },
      });
      flipped += 1;
    }

    await tx
      .update(partnerPayoutBatches)
      .set({ status: "paid", paidAt: now, paidBy: actor.actorId ?? null })
      .where(eq(partnerPayoutBatches.id, batchId));

    return flipped;
  });
}
