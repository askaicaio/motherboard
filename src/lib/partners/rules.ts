// =============================================================
// Partner Program — pure rules engine
// =============================================================
// Every function here is PURE (no DB, no IO) so the commission math,
// rate resolution, window dates, and direct-intro validation can be
// unit-tested exhaustively. DB-touching checks (new-customer gate,
// active-settings lookup) live in ingest.ts and queries.ts and are
// integration-tested.
//
// Rules sourced from the binding Terms + Playbook:
//   §3.1 first-purchase-only · §3.2 new-customer by email
//   §3.3 commission basis = gross − fees − non_commissionable (NOT list)
//   §4   lifecycle + refund window · §5 attribution + 14-day dispute
// =============================================================

import { randomBytes } from "crypto";

// ---- Ref code ---------------------------------------------------------

const REF_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * 8-char base62 ref code. ~62^8 ≈ 2.18e14 space — collisions are
 * astronomically unlikely, but callers should still retry on the
 * unique-constraint violation just in case.
 */
export function generateRefCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  }
  return out;
}

// ---- Rate resolution --------------------------------------------------

export interface SettingsLike {
  defaultCommissionRate: string; // e.g. "0.10"
  cookieWindowDays: number;
  refundWindowDays: number;
}

export interface ProgramLike {
  commissionRateOverride: string | null;
  setupFeeCents: number;
  stripeFeePassthroughCents: number;
}

/** Parse a stored rate string ("0.10") to a number in [0,1]. Throws on garbage. */
export function parseRate(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`Invalid commission rate: ${JSON.stringify(raw)}`);
  }
  return n;
}

/** Program override wins over the campaign default. */
export function resolveRate(
  program: Pick<ProgramLike, "commissionRateOverride">,
  settings: Pick<SettingsLike, "defaultCommissionRate">,
): number {
  if (program.commissionRateOverride != null && program.commissionRateOverride !== "") {
    return parseRate(program.commissionRateOverride);
  }
  return parseRate(settings.defaultCommissionRate);
}

// ---- Commission basis (Terms §3.3) -----------------------------------

export interface CommissionInput {
  grossCents: number;
  feesCents: number;
  nonCommissionableCents: number;
  rate: number;
}

export interface CommissionResult {
  commissionableCents: number;
  commissionCents: number;
}

/**
 * commissionable = gross − fees − non_commissionable, floored at 0.
 * commission     = round(commissionable × rate).
 * NEVER computed on list price (Terms §3.3).
 *
 * Round (not floor) on the final cent so the partner isn't shorted; the
 * max swing is half a cent, immaterial against engagement values.
 */
export function computeCommission(input: CommissionInput): CommissionResult {
  const { grossCents, feesCents, nonCommissionableCents, rate } = input;
  const commissionableCents = Math.max(
    0,
    Math.round(grossCents - feesCents - nonCommissionableCents),
  );
  const commissionCents = Math.round(commissionableCents * rate);
  return { commissionableCents, commissionCents };
}

// ---- Window math (timezone-safe; all UTC instant arithmetic) ----------

const DAY_MS = 24 * 60 * 60 * 1000;

/** purchased_at + N days, as a Date. Pure instant arithmetic — DST-safe. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

export interface WindowDates {
  refundWindowEndsAt: Date;
  disputeWindowEndsAt: Date;
}

/** Refund window per settings, dispute window fixed at 14d (Terms §5.4). */
export function computeWindows(
  purchasedAt: Date,
  refundWindowDays: number,
): WindowDates {
  return {
    refundWindowEndsAt: addDays(purchasedAt, refundWindowDays),
    disputeWindowEndsAt: addDays(purchasedAt, 14),
  };
}

/** Has the refund window elapsed as of `now`? (pending → earned gate) */
export function refundWindowPassed(refundWindowEndsAt: Date, now: Date): boolean {
  return now.getTime() >= refundWindowEndsAt.getTime();
}

/** Is a click still within the cookie window, measured from the click time? */
export function clickWithinWindow(
  clickCreatedAt: Date,
  cookieWindowDays: number,
  asOf: Date,
): boolean {
  return asOf.getTime() - clickCreatedAt.getTime() <= cookieWindowDays * DAY_MS;
}

/** Is a dispute within the 14-day-from-close window? (Terms §5.4) */
export function disputeWithinWindow(dealCloseDate: Date, submittedAt: Date): boolean {
  return submittedAt.getTime() <= addDays(dealCloseDate, 14).getTime();
}

// ---- Direct-intro validation (Playbook §13) ---------------------------

/**
 * A direct introduction is only valid if it was logged BEFORE the sales
 * proposal went out. If proposalSentAt is unknown (null), we can't prove
 * it was late, so it stays valid (admin can invalidate manually).
 */
export function isDirectIntroValid(
  recordedAt: Date,
  proposalSentAt: Date | null | undefined,
): boolean {
  if (!proposalSentAt) return true;
  return recordedAt.getTime() <= proposalSentAt.getTime();
}

// ---- First-attribution-wins (Terms §5.3) ------------------------------

export interface AttributionCandidate {
  id: string;
  type: "tracked_link" | "direct_intro";
  recordedAt: Date;
  isValid: boolean;
}

/**
 * First attribution wins by recorded_at. Only valid events are eligible.
 * A documented direct_intro beating an expired cookie is handled upstream
 * by the caller only passing in still-eligible candidates (expired clicks
 * are filtered before this runs); among eligible ones, earliest timestamp
 * wins regardless of type, which satisfies "intro beats expired cookie"
 * because the expired cookie's click is never an eligible candidate.
 */
export function pickFirstAttribution(
  candidates: AttributionCandidate[],
): AttributionCandidate | null {
  const eligible = candidates.filter((c) => c.isValid);
  if (eligible.length === 0) return null;
  return eligible.reduce((earliest, c) =>
    c.recordedAt.getTime() < earliest.recordedAt.getTime() ? c : earliest,
  );
}
