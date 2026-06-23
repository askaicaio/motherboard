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
//
// CONCURRENCY: Stripe delivers webhooks at-least-once and out of order,
// and a refund + a dispute can hit the same charge. So reverseConversion
// and createClawback both take a FOR UPDATE row lock on the conversion
// and re-check status under the lock — that serializes concurrent
// deliveries and prevents the double-clawback money bug. They accept an
// optional transaction client so the caller (the webhook) can lock the
// row once and run the whole reverse-vs-clawback decision atomically.
// =============================================================

import { db } from "@/lib/db";
import {
  partnerConversions,
  partnerConversionEvents,
  partnerPayoutBatches,
} from "@/lib/db/schema";
import { and, eq, isNotNull, lte, ne, sql } from "drizzle-orm";

interface Actor {
  actorId?: string | null;
  actorEmail?: string | null;
}

/** A db handle or a transaction handle — both expose the query builder. */
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function recordEvent(
  client: DbClient,
  conversionId: string,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  actor: Actor,
  details: Record<string, unknown> = {},
) {
  await client.insert(partnerConversionEvents).values({
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
 * are eligible — rejected/unmatched rows never promote. Rows with an
 * UNRESOLVED partial-refund review are held back (their basis is
 * overstated until an admin reconciles). Returns the number promoted.
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
        // Hold back any conversion with an open partial_refund_review event
        // (a later partial_refund_resolved event clears it).
        sql`NOT EXISTS (
          SELECT 1 FROM partner_conversion_events e
          WHERE e.conversion_id = ${partnerConversions.id}
            AND e.event_type = 'partial_refund_review'
            AND NOT EXISTS (
              SELECT 1 FROM partner_conversion_events r
              WHERE r.conversion_id = e.conversion_id
                AND r.event_type = 'partial_refund_resolved'
                AND r.occurred_at > e.occurred_at
            )
        )`,
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
    await recordEvent(db, row.id, "status_changed", "pending", "earned", {
      actorEmail: "system:cron",
    });
    promoted += 1;
  }
  return promoted;
}

// ---- Reverse (refund-in-window / dispute) -----------------------------

async function reverseWork(
  tx: DbClient,
  conversionId: string,
  reason: string,
  actor: Actor,
): Promise<void> {
  // FOR UPDATE lock + re-check under the lock makes concurrent deliveries
  // serialize: the loser reads status='reversed' and no-ops (no dup audit row).
  const [row] = await tx
    .select()
    .from(partnerConversions)
    .where(eq(partnerConversions.id, conversionId))
    .for("update")
    .limit(1);
  if (!row || row.status === "reversed") return;

  await tx
    .update(partnerConversions)
    .set({ status: "reversed", updatedAt: new Date() })
    .where(eq(partnerConversions.id, conversionId));

  await recordEvent(tx, conversionId, "status_changed", row.status, "reversed", actor, {
    reason,
  });
}

/**
 * Reverse a conversion (refund/chargeback within window, or dispute).
 * Idempotent + concurrency-safe via the row lock. Pass an existing tx to
 * run inside a larger atomic decision; omit it to self-contain.
 */
export async function reverseConversion(
  conversionId: string,
  reason: string,
  actor: Actor = {},
  client?: DbClient,
): Promise<void> {
  if (client) return reverseWork(client, conversionId, reason, actor);
  await db.transaction((tx) => reverseWork(tx, conversionId, reason, actor));
}

// ---- Clawback (refund after a PAID commission) ------------------------

async function clawbackWork(
  tx: DbClient,
  originalConversionId: string,
  reason: string,
  actor: Actor,
): Promise<string | null> {
  // Lock the original row so two concurrent deliveries can't both observe
  // 'paid' and both insert a clawback.
  const [orig] = await tx
    .select()
    .from(partnerConversions)
    .where(eq(partnerConversions.id, originalConversionId))
    .for("update")
    .limit(1);
  if (!orig) return null;

  // Belt-and-suspenders: if a clawback already exists for this original,
  // we've already handled it — no-op.
  const [existing] = await tx
    .select({ id: partnerConversions.id })
    .from(partnerConversions)
    .where(eq(partnerConversions.clawbackOfConversionId, orig.id))
    .limit(1);
  if (existing) return existing.id;

  // Only paid commissions get a clawback. In-window reversals (status
  // pending/earned) just reverse — no negative row.
  if (orig.status !== "paid") {
    if (orig.status !== "reversed") {
      await tx
        .update(partnerConversions)
        .set({ status: "reversed", updatedAt: new Date() })
        .where(eq(partnerConversions.id, originalConversionId));
      await recordEvent(
        tx,
        originalConversionId,
        "status_changed",
        orig.status,
        "reversed",
        actor,
        { reason, note: "reversed without clawback (was not paid)" },
      );
    }
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

  await recordEvent(tx, orig.id, "status_changed", "paid", "reversed", actor, {
    reason,
    clawbackId: clawback.id,
  });
  await recordEvent(tx, clawback.id, "clawback_created", null, "earned", actor, {
    reason,
    clawbackOf: orig.id,
    amountCents: -orig.commissionCents,
  });

  return clawback.id;
}

/**
 * A commission that was already PAID is later refunded/charged back. We
 * book a negative clawback row (status=earned so the next batch nets it
 * out) and flip the original to reversed. Concurrency-safe via the lock +
 * existing-clawback short-circuit + the partial unique index on
 * clawback_of_conversion_id. Pass an existing tx to run inside a larger
 * atomic decision; omit it to self-contain.
 */
export async function createClawback(
  originalConversionId: string,
  reason: string,
  actor: Actor = {},
  client?: DbClient,
): Promise<string | null> {
  if (client) return clawbackWork(client, originalConversionId, reason, actor);
  return db.transaction((tx) => clawbackWork(tx, originalConversionId, reason, actor));
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
      await recordEvent(tx, row.id, "status_changed", "earned", "paid", actor, {
        batchId,
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
