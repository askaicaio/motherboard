// =============================================================
// Automation errors — read helpers
// =============================================================
// Reads captured error events (the `automation_errors` table) for display.
// Write/capture helpers live per platform (Make first: make-errors-sync).
//
// The Per Website Error History page uses getErrorHistoryRows() to list a
// platform's errors newest-first, joined to their automation for the name +
// link the table shows.
// =============================================================

import { db } from "@/lib/db";
import { automationErrors, automations, appSettings } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Error-sweep schedule (Cron-B due-timer).
// The full Make error sweep is expensive-ish (one call per scenario), so it
// doesn't run every 5-min cron tick. Instead the cron checks this stored
// "next sweep due" time and only sweeps when it's passed — same pattern as the
// auto-refresh 24h timer. Interval is 8h (only ~3 sweeps/day; light on Make).
// Persisted in app_settings under a single key (no migration).
// ---------------------------------------------------------------------------
const SWEEP_KEY = "automations_error_sweep";
/** How often the full error sweep runs on its own (8 hours). */
export const ERROR_SWEEP_INTERVAL_MS = 8 * 60 * 60 * 1000;
/** Ignore a MANUAL "check now" request within this long of the last sweep
 *  (light guard against mashing the button). */
const MANUAL_MIN_GAP_MS = 60 * 1000;

interface ErrorSweepState {
  /** ISO time the next sweep is due; the cron runs a sweep once now >= this. */
  nextSweepAt?: string;
  /** ISO time the last sweep actually ran. */
  lastSweptAt?: string;
}

async function readSweepState(): Promise<ErrorSweepState> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SWEEP_KEY))
    .limit(1);
  return (row?.value as ErrorSweepState | undefined) ?? {};
}

async function writeSweepState(value: ErrorSweepState): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: SWEEP_KEY, value: value as never, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: value as never, updatedAt: new Date() },
    });
}

/** True when the error sweep is due (never run yet, or the stored due time has
 *  passed). The 5-min checker cron calls this each tick. */
export async function isErrorSweepDue(): Promise<boolean> {
  const { nextSweepAt } = await readSweepState();
  if (!nextSweepAt) return true; // never swept
  return new Date(nextSweepAt).getTime() <= Date.now();
}

/** Push the next sweep out by the interval + stamp lastSweptAt=now. Called after
 *  a sweep runs (success or failure) so a persistent failure can't hammer Make. */
export async function bumpErrorSweep(): Promise<void> {
  const now = Date.now();
  await writeSweepState({
    nextSweepAt: new Date(now + ERROR_SWEEP_INTERVAL_MS).toISOString(),
    lastSweptAt: new Date(now).toISOString(),
  });
}

/**
 * MANUAL "check for errors now" — make the sweep due immediately so the next
 * 5-min cron tick runs it (server-side, unattended; the user can close the app).
 * Light guard: no-op if a sweep is already pending (due), or if one ran within
 * the last minute. Returns whether it queued and why not.
 */
export async function requestErrorSweep(): Promise<{
  queued: boolean;
  reason?: "pending" | "recent";
}> {
  const state = await readSweepState();
  const now = Date.now();
  // Already due/pending — a sweep is queued for the next tick; nothing to do.
  if (state.nextSweepAt && new Date(state.nextSweepAt).getTime() <= now) {
    return { queued: false, reason: "pending" };
  }
  // A sweep just ran — don't allow an immediate re-run.
  if (
    state.lastSweptAt &&
    now - new Date(state.lastSweptAt).getTime() < MANUAL_MIN_GAP_MS
  ) {
    return { queued: false, reason: "recent" };
  }
  // Queue it: make it due now (preserve lastSweptAt for the guard above).
  await writeSweepState({
    nextSweepAt: new Date(now).toISOString(),
    lastSweptAt: state.lastSweptAt,
  });
  return { queued: true };
}

/** One error row as the Error History table wants it (matches ErrorHistoryRow
 *  in error-history-table.tsx: id + name + link + message + date). */
export interface ErrorHistoryRowData {
  id: string;
  name: string;
  externalUrl: string;
  errorMessage: string | null;
  errorAt: Date | null;
}

/**
 * A platform's error events, NEWEST FIRST, joined to their automation for the
 * name + link. Feeds the Per Website Error History table. Returns [] when the
 * platform has no captured errors (the normal case until capture runs).
 */
export async function getErrorHistoryRows(
  platform: string,
): Promise<ErrorHistoryRowData[]> {
  return db
    .select({
      id: automationErrors.id,
      name: automations.name,
      externalUrl: automations.externalUrl,
      errorMessage: automationErrors.message,
      errorAt: automationErrors.occurredAt,
    })
    .from(automationErrors)
    .innerJoin(automations, eq(automationErrors.automationId, automations.id))
    .where(eq(automationErrors.platform, platform))
    .orderBy(desc(automationErrors.occurredAt));
}
