// =============================================================
// Partner Program — payout batch generation (money)
// =============================================================
// Accumulate-to-threshold model from the Terms:
//   - Commissions become payable once EARNED (refund window passed clean).
//   - A partner is only included once their earned-but-unbatched balance
//     reaches the minimum threshold ($100); under-threshold balances roll
//     forward to the next cycle.
//   - A connected Stripe payout account (stripe_connect_status='ready') is
//     REQUIRED — it's the automatic, compliant rail (collects bank + tax info,
//     Stripe issues the 1099). Earned balances are held until the affiliate
//     connects; then the monthly run transfers automatically with zero ops work.
//   - Negative clawback rows are status='earned' too, so summing earned
//     rows nets clawbacks automatically.
//
// All money in integer cents. Batch generation is atomic.
// =============================================================

import { db } from "@/lib/db";
import {
  partners,
  partnerConversions,
  partnerConversionEvents,
  partnerPayoutBatches,
} from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getActiveSettings } from "./queries";
import { getStripe } from "@/lib/integrations/stripe-client";

export interface PayoutLine {
  partnerId: string;
  name: string;
  email: string;
  company: string | null;
  payoutMethod: string;
  taxFormStatus: string;
  amountCents: number;
  conversionIds: string[];
}

export interface PayoutPreview {
  minPayoutCents: number;
  included: PayoutLine[];
  /** Partners with a positive balance but blocked (under threshold or tax). */
  excluded: Array<PayoutLine & { reason: string }>;
  totalCents: number;
}

/**
 * Compute who would be paid right now. Pure read — no writes. Groups all
 * earned + unbatched conversions by partner and applies the threshold +
 * tax gate against the CURRENT active settings.
 */
export async function previewPayout(): Promise<PayoutPreview> {
  const settings = await getActiveSettings(new Date());
  const minPayoutCents = settings?.minPayoutCents ?? 10000;

  // All earned, not-yet-batched conversions joined to their partner.
  const rows = await db
    .select({
      conversionId: partnerConversions.id,
      commissionCents: partnerConversions.commissionCents,
      partnerId: partners.id,
      name: partners.name,
      email: partners.email,
      company: partners.company,
      payoutMethod: partners.payoutMethod,
      taxFormStatus: partners.taxFormStatus,
      partnerStatus: partners.status,
      connectStatus: partners.stripeConnectStatus,
    })
    .from(partnerConversions)
    .innerJoin(partners, eq(partnerConversions.partnerId, partners.id))
    .where(
      and(
        eq(partnerConversions.status, "earned"),
        isNull(partnerConversions.payoutBatchId),
        // Never pay out seeded sample conversions.
        eq(partnerConversions.isSample, false),
      ),
    );

  // Aggregate per partner.
  const byPartner = new Map<
    string,
    PayoutLine & { partnerStatus: string; connectStatus: string }
  >();
  for (const r of rows) {
    let line = byPartner.get(r.partnerId);
    if (!line) {
      line = {
        partnerId: r.partnerId,
        name: r.name,
        email: r.email,
        company: r.company,
        payoutMethod: r.payoutMethod,
        taxFormStatus: r.taxFormStatus,
        amountCents: 0,
        conversionIds: [],
        partnerStatus: r.partnerStatus,
        connectStatus: r.connectStatus,
      };
      byPartner.set(r.partnerId, line);
    }
    line.amountCents += r.commissionCents;
    line.conversionIds.push(r.conversionId);
  }

  const included: PayoutLine[] = [];
  const excluded: Array<PayoutLine & { reason: string }> = [];

  for (const line of byPartner.values()) {
    const { partnerStatus, connectStatus, ...payoutLine } = line;
    if (payoutLine.amountCents <= 0) {
      // Net-negative (clawback heavy) or zero — carries forward as a debit.
      excluded.push({ ...payoutLine, reason: "non_positive_balance" });
      continue;
    }
    if (!["approved", "active"].includes(partnerStatus)) {
      excluded.push({ ...payoutLine, reason: "partner_not_active" });
      continue;
    }
    // Stripe Connect is REQUIRED to be paid — it's the only fully-automatic,
    // compliant rail (collects the affiliate's bank + tax info; Stripe issues
    // the 1099). Earned balances are held until the affiliate connects.
    if (connectStatus !== "ready") {
      excluded.push({ ...payoutLine, reason: "payout_account_not_connected" });
      continue;
    }
    if (payoutLine.amountCents < minPayoutCents) {
      excluded.push({ ...payoutLine, reason: "under_threshold" });
      continue;
    }
    included.push(payoutLine);
  }

  const totalCents = included.reduce((s, l) => s + l.amountCents, 0);
  return { minPayoutCents, included, excluded, totalCents };
}

/**
 * Create a draft payout batch from the current preview and stamp the
 * included earned conversions with the batch id. Atomic. Returns the
 * batch row + the included lines.
 */
export async function generatePayoutBatch(
  periodYyyymm: number,
  actorId: string | null,
): Promise<{ batchId: string; totalCents: number; lines: PayoutLine[] }> {
  const preview = await previewPayout();
  if (preview.included.length === 0) {
    throw new Error("No partners are eligible for payout right now.");
  }

  return db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(partnerPayoutBatches)
      .values({
        periodYyyymm,
        status: "draft",
        totalCents: preview.totalCents,
        generatedBy: actorId,
      })
      .returning();

    // Assign the batch id to every included earned conversion. Re-assert
    // status='earned' AND payout_batch_id IS NULL in the WHERE so a row
    // that got batched by a concurrent run isn't double-claimed.
    const allConversionIds = preview.included.flatMap((l) => l.conversionIds);
    for (const cid of allConversionIds) {
      await tx
        .update(partnerConversions)
        .set({ payoutBatchId: batch.id, updatedAt: new Date() })
        .where(
          and(
            eq(partnerConversions.id, cid),
            eq(partnerConversions.status, "earned"),
            isNull(partnerConversions.payoutBatchId),
          ),
        );
    }

    return {
      batchId: batch.id,
      totalCents: preview.totalCents,
      lines: preview.included,
    };
  });
}

/** Finance CSV: partner, method, tax status, amount. One row per partner. */
export async function buildPayoutCsv(batchId: string): Promise<string> {
  const rows = await db
    .select({
      name: partners.name,
      email: partners.email,
      company: partners.company,
      payoutMethod: partners.payoutMethod,
      taxFormStatus: partners.taxFormStatus,
      payoutDetails: partners.payoutDetails,
      commissionCents: partnerConversions.commissionCents,
    })
    .from(partnerConversions)
    .innerJoin(partners, eq(partnerConversions.partnerId, partners.id))
    .where(eq(partnerConversions.payoutBatchId, batchId));

  const byPartner = new Map<
    string,
    {
      name: string;
      email: string;
      company: string | null;
      payoutMethod: string;
      taxFormStatus: string;
      payoutDetails: string | null;
      amountCents: number;
    }
  >();
  for (const r of rows) {
    let agg = byPartner.get(r.email);
    if (!agg) {
      agg = {
        name: r.name,
        email: r.email,
        company: r.company,
        payoutMethod: r.payoutMethod,
        taxFormStatus: r.taxFormStatus,
        payoutDetails: r.payoutDetails,
        amountCents: 0,
      };
      byPartner.set(r.email, agg);
    }
    agg.amountCents += r.commissionCents;
  }

  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "Partner",
    "Email",
    "Company",
    "Payout Method",
    "Tax Form",
    "Payout Details",
    "Amount (USD)",
  ];
  const lines = [header.join(",")];
  for (const a of byPartner.values()) {
    lines.push(
      [
        a.name,
        a.email,
        a.company,
        a.payoutMethod,
        a.taxFormStatus,
        a.payoutDetails,
        (a.amountCents / 100).toFixed(2),
      ]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n");
}

export interface ConnectReleaseSummary {
  /** Number of affiliates successfully paid via a Stripe transfer. */
  released: number;
  /** Total cents transferred across all successful affiliates. */
  transferredCents: number;
  /** Affiliates in the batch that weren't Connect-ready (left for manual ACH). */
  skipped: number;
  /** Per-affiliate failures — these rows stay 'earned' for manual handling. */
  errors: Array<{ partnerId: string; email: string; error: string }>;
}

/**
 * Pay every Connect-ready affiliate in a generated batch automatically via
 * Stripe transfers. For each affiliate with stripeConnectStatus === 'ready'
 * and a stripeConnectAccountId, we sum their earned conversions in the batch
 * and push a single transfer to their connected account. On success the
 * affiliate's conversions in the batch flip 'earned' -> 'paid' and an audit
 * event is appended per conversion.
 *
 * Affiliates without Connect (no account / not ready) are SKIPPED and remain
 * 'earned' so they're still handled by the manual ACH / CSV export flow.
 *
 * Per-affiliate try/catch — one failed transfer never aborts the others.
 * Money is integer cents throughout, mirroring markBatchPaid.
 */
export async function releaseBatchViaConnect(
  batchId: string,
): Promise<ConnectReleaseSummary> {
  const summary: ConnectReleaseSummary = {
    released: 0,
    transferredCents: 0,
    skipped: 0,
    errors: [],
  };

  // All earned conversions in this batch, joined to their partner's Connect state.
  const rows = await db
    .select({
      conversionId: partnerConversions.id,
      commissionCents: partnerConversions.commissionCents,
      status: partnerConversions.status,
      partnerId: partners.id,
      email: partners.email,
      connectAccountId: partners.stripeConnectAccountId,
      connectStatus: partners.stripeConnectStatus,
    })
    .from(partnerConversions)
    .innerJoin(partners, eq(partnerConversions.partnerId, partners.id))
    .where(eq(partnerConversions.payoutBatchId, batchId));

  // Aggregate the earned rows per partner.
  interface ReleaseGroup {
    partnerId: string;
    email: string;
    connectAccountId: string | null;
    connectStatus: string;
    amountCents: number;
    conversionIds: string[];
  }
  const byPartner = new Map<string, ReleaseGroup>();
  for (const r of rows) {
    if (r.status !== "earned") continue; // only earned rows are payable
    let g = byPartner.get(r.partnerId);
    if (!g) {
      g = {
        partnerId: r.partnerId,
        email: r.email,
        connectAccountId: r.connectAccountId,
        connectStatus: r.connectStatus,
        amountCents: 0,
        conversionIds: [],
      };
      byPartner.set(r.partnerId, g);
    }
    g.amountCents += r.commissionCents;
    g.conversionIds.push(r.conversionId);
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    // Stripe not configured at all — nothing can be auto-released. Treat every
    // group as skipped so they fall through to manual ACH.
    summary.skipped = byPartner.size;
    return summary;
  }

  for (const g of byPartner.values()) {
    // Not Connect-ready, or nothing to pay — leave for manual ACH.
    if (
      g.connectStatus !== "ready" ||
      !g.connectAccountId ||
      g.amountCents <= 0
    ) {
      summary.skipped += 1;
      continue;
    }

    try {
      await stripe.transfers.create({
        amount: g.amountCents,
        currency: "usd",
        destination: g.connectAccountId,
        transfer_group: `batch_${batchId}`,
      });

      // Transfer succeeded — flip this affiliate's earned conversions to paid
      // and append an audit event per conversion. Re-assert status='earned' in
      // the WHERE so a concurrent run can't double-pay.
      const now = new Date();
      await db.transaction(async (tx) => {
        for (const cid of g.conversionIds) {
          await tx
            .update(partnerConversions)
            .set({ status: "paid", updatedAt: now })
            .where(
              and(
                eq(partnerConversions.id, cid),
                eq(partnerConversions.status, "earned"),
              ),
            );
          await tx.insert(partnerConversionEvents).values({
            conversionId: cid,
            eventType: "status_changed",
            fromStatus: "earned",
            toStatus: "paid",
            details: { batchId, via: "stripe_connect" },
          });
        }
      });

      summary.released += 1;
      summary.transferredCents += g.amountCents;
    } catch (err) {
      const message = err instanceof Error ? err.message : "transfer failed";
      summary.errors.push({
        partnerId: g.partnerId,
        email: g.email,
        error: message,
      });
    }
  }

  return summary;
}
