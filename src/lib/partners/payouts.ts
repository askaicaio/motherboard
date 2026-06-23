// =============================================================
// Partner Program — payout batch generation (money)
// =============================================================
// Accumulate-to-threshold model from the Terms:
//   - Commissions become payable once EARNED (refund window passed clean).
//   - A partner is only included once their earned-but-unbatched balance
//     reaches the minimum threshold ($100); under-threshold balances roll
//     forward to the next cycle.
//   - Tax form must be valid (w9 / w8ben / w8bene) before any payout.
//   - Negative clawback rows are status='earned' too, so summing earned
//     rows nets clawbacks automatically.
//
// All money in integer cents. Batch generation is atomic.
// =============================================================

import { db } from "@/lib/db";
import {
  partners,
  partnerConversions,
  partnerPayoutBatches,
} from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getActiveSettings } from "./queries";

const VALID_TAX_STATUSES = ["w9", "w8ben", "w8bene"];

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
    })
    .from(partnerConversions)
    .innerJoin(partners, eq(partnerConversions.partnerId, partners.id))
    .where(
      and(
        eq(partnerConversions.status, "earned"),
        isNull(partnerConversions.payoutBatchId),
      ),
    );

  // Aggregate per partner.
  const byPartner = new Map<string, PayoutLine & { partnerStatus: string }>();
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
      };
      byPartner.set(r.partnerId, line);
    }
    line.amountCents += r.commissionCents;
    line.conversionIds.push(r.conversionId);
  }

  const included: PayoutLine[] = [];
  const excluded: Array<PayoutLine & { reason: string }> = [];

  for (const line of byPartner.values()) {
    const { partnerStatus, ...payoutLine } = line;
    if (payoutLine.amountCents <= 0) {
      // Net-negative (clawback heavy) or zero — carries forward as a debit.
      excluded.push({ ...payoutLine, reason: "non_positive_balance" });
      continue;
    }
    if (!["approved", "active"].includes(partnerStatus)) {
      excluded.push({ ...payoutLine, reason: "partner_not_active" });
      continue;
    }
    if (!VALID_TAX_STATUSES.includes(payoutLine.taxFormStatus)) {
      excluded.push({ ...payoutLine, reason: "tax_form_invalid" });
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
