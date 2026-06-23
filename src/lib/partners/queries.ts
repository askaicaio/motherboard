// =============================================================
// Partner Program — DB query helpers
// =============================================================
// Thin data-access functions shared by the click route, ingest core,
// and cron jobs. Kept separate from rules.ts (pure logic) so the rules
// stay unit-testable without a DB.
// =============================================================

import { db } from "@/lib/db";
import {
  partners,
  partnerSettings,
  partnerPrograms,
  partnerConversions,
  customersIndex,
} from "@/lib/db/schema";
import { and, desc, eq, inArray, lte, or } from "drizzle-orm";

export type ActiveSettings = typeof partnerSettings.$inferSelect;

/**
 * The settings row in effect AS OF a given instant. Append-only history,
 * so we take the latest row whose effective_from <= asOf. Falls back to
 * the most recent row overall if none predate asOf (shouldn't happen
 * after seeding, but keeps the gate from throwing).
 */
export async function getActiveSettings(asOf: Date): Promise<ActiveSettings | null> {
  const [row] = await db
    .select()
    .from(partnerSettings)
    .where(lte(partnerSettings.effectiveFrom, asOf))
    .orderBy(desc(partnerSettings.effectiveFrom))
    .limit(1);
  if (row) return row;
  // Fallback: earliest-available config (covers asOf before first effective_from)
  const [fallback] = await db
    .select()
    .from(partnerSettings)
    .orderBy(partnerSettings.effectiveFrom)
    .limit(1);
  return fallback ?? null;
}

/** Resolve a ref_code to a partner row (any status). Null if unknown. */
export async function getPartnerByRefCode(refCode: string) {
  const [row] = await db
    .select()
    .from(partners)
    .where(eq(partners.refCode, refCode))
    .limit(1);
  return row ?? null;
}

/** Resolve a program by id OR slug OR stripe_price_id (external ref tolerance). */
export async function resolveProgram(ref: string) {
  // Try id first (uuid), then slug, then stripe price id.
  const [row] = await db
    .select()
    .from(partnerPrograms)
    .where(
      or(
        eq(partnerPrograms.id, ref),
        eq(partnerPrograms.slug, ref),
        eq(partnerPrograms.stripePriceId, ref),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * New-customer gate (Terms §3.2). A buyer is NEW only if their email has
 * no prior completed CAIO transaction. We check two sources:
 *   1. customers_index — the seeded list of all prior buyers
 *   2. prior partner_conversions in a committed money state for this email
 * Identity is by lowercased email.
 */
export async function isNewCustomer(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();

  const [seeded] = await db
    .select({ email: customersIndex.email })
    .from(customersIndex)
    .where(eq(customersIndex.email, normalized))
    .limit(1);
  if (seeded) return false;

  const [prior] = await db
    .select({ id: partnerConversions.id })
    .from(partnerConversions)
    .where(
      and(
        eq(partnerConversions.buyerEmail, normalized),
        inArray(partnerConversions.status, ["pending", "earned", "paid"]),
      ),
    )
    .limit(1);
  return !prior;
}

/**
 * First-purchase-only gate (Terms §3.1). True when this buyer already has
 * a prior COMMISSIONABLE conversion (one with a real partner + committed
 * money state). Renewals/upgrades/expansions therefore never re-commission.
 */
export async function hasPriorCommissionableConversion(
  email: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const [prior] = await db
    .select({ id: partnerConversions.id })
    .from(partnerConversions)
    .where(
      and(
        eq(partnerConversions.buyerEmail, normalized),
        inArray(partnerConversions.status, ["pending", "earned", "paid"]),
      ),
    )
    .limit(1);
  return !!prior;
}
