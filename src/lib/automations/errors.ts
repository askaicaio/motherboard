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
import { desc, eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Error-sweep triggers.
// Error capture (the full Make sweep, one call per scenario) is COUPLED to the
// per-platform Auto-refresh toggle: when a platform's 24h refresh fires, the
// checker cron sweeps that platform's errors in the same cycle (so toggle OFF =
// no auto capture). See the cron route's auto-refresh loop.
//
// This module only tracks the OTHER trigger: the manual "Check for New Errors"
// button, which queues a ONE-SHOT sweep for the next 5-min cron tick regardless
// of the toggle (an always-available escape hatch). Persisted in app_settings
// under a single key (no migration).
// ---------------------------------------------------------------------------
const SWEEP_KEY = "automations_error_sweep";
/** Ignore a MANUAL "check now" request within this long of the last sweep
 *  (light guard against mashing the button). */
const MANUAL_MIN_GAP_MS = 60 * 1000;

interface ErrorSweepState {
  /** A manual "check for new errors" is queued for the next cron tick. */
  manualPending?: boolean;
  /** ISO time the last sweep actually ran (any trigger). Feeds the anti-mash
   *  guard so a manual click just after a sweep is ignored. */
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

/** True when a manual "check now" is queued (button-driven, toggle-independent).
 *  The 5-min checker cron calls this each tick. */
export async function isManualSweepPending(): Promise<boolean> {
  const { manualPending } = await readSweepState();
  return manualPending === true;
}

/** Clear the manual flag + stamp lastSweptAt=now. Called after ANY sweep runs
 *  (toggle-driven or manual) so the flag resets and the anti-mash guard holds,
 *  even when a persistent failure occurred (so it can't hammer Make). */
export async function markErrorSweepDone(): Promise<void> {
  const state = await readSweepState();
  await writeSweepState({
    ...state,
    manualPending: false,
    lastSweptAt: new Date().toISOString(),
  });
}

/**
 * MANUAL "check for errors now" — queue a one-shot sweep for the next 5-min
 * cron tick (server-side, unattended; the user can close the app). Works
 * regardless of the auto-refresh toggle. Light guard: no-op if a sweep is
 * already queued, or if one ran within the last minute. Returns whether it
 * queued and why not.
 */
export async function requestErrorSweep(): Promise<{
  queued: boolean;
  reason?: "pending" | "recent";
}> {
  const state = await readSweepState();
  const now = Date.now();
  // Already queued for the next tick; nothing to do.
  if (state.manualPending) {
    return { queued: false, reason: "pending" };
  }
  // A sweep just ran — don't allow an immediate re-run.
  if (
    state.lastSweptAt &&
    now - new Date(state.lastSweptAt).getTime() < MANUAL_MIN_GAP_MS
  ) {
    return { queued: false, reason: "recent" };
  }
  await writeSweepState({ ...state, manualPending: true });
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

/**
 * Total captured errors per platform (one grouped query). Feeds the Main Page
 * "# Errors" card stat. Platforms with no captured errors are absent from the
 * map, so callers should default to 0. Today only Make writes rows, so the
 * other platforms read 0 until their capture lands.
 */
export async function getErrorCountsByPlatform(): Promise<
  Record<string, number>
> {
  const rows = await db
    .select({
      platform: automationErrors.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(automationErrors)
    .groupBy(automationErrors.platform);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.platform] = r.count;
  return counts;
}

/**
 * Latest error timestamp per automation for ONE platform, keyed by automation
 * id. Feeds the Per Website table's "Last Error" column (each row shows its own
 * most-recent error date). Automations with no captured errors are absent, so
 * their cell renders "-". Returns an empty map when the platform has none.
 */
export async function getLastErrorAtByPlatform(
  platform: string,
): Promise<Map<string, Date>> {
  const rows = await db
    .select({
      automationId: automationErrors.automationId,
      lastErrorAt: sql<string>`max(${automationErrors.occurredAt})`,
    })
    .from(automationErrors)
    .where(eq(automationErrors.platform, platform))
    .groupBy(automationErrors.automationId);

  const map = new Map<string, Date>();
  for (const r of rows) {
    // max() returns null only for an all-null group, which can't happen here
    // (occurred_at is NOT NULL). Coerce defensively: the driver may hand back a
    // Date or an ISO string depending on how the aggregate is parsed.
    if (r.lastErrorAt) map.set(r.automationId, new Date(r.lastErrorAt));
  }
  return map;
}
