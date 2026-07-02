// =============================================================
// Auto-API health check state — Option A (mirrors autorefresh.ts)
// =============================================================
// Stores, in the existing `app_settings` key/value table (no migration):
//   - the SINGLE global "Auto-API health check" toggle (enabled + when the next
//     scheduled check is due). One toggle drives a check of ALL platforms, so
//     this is one object, not a per-platform map (unlike auto-refresh).
//   - the LAST result per platform ({ ok, checkedAt }), written by the scheduled
//     check (the cron) so the Main Page cards can show each platform's last-known
//     status without anyone clicking.
//
// Option A semantics (same as auto-refresh, cadence chosen by user = 24h):
//   - Turning ON anchors the clock to now (nextCheckAt = now + 24h). No immediate
//     check — the first fires when the clock elapses (the manual "API Health
//     Check" button covers "check now").
//   - The background checker cron runs the all-platform verify once
//     `now >= nextCheckAt`, stores the results, then bumps nextCheckAt by 24h.
//   - Turning OFF clears the schedule but KEEPS the last stored results.
// =============================================================

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const KEY = "automations_health";
/** ⚠️ TEMPORARY DEV TEST (2026-07-01): 1 MINUTE so the scheduled health check /
 *  its looping countdown can be watched live. REVERT to `24 * 60 * 60 * 1000`
 *  (24h) right after the test. */
export const AUTO_HEALTH_CHECK_INTERVAL_MS = 60 * 1000;

/** One platform's last check outcome. */
export interface HealthResult {
  ok: boolean;
  /** ISO timestamp of when this result was recorded. */
  checkedAt: string;
}

export interface HealthState {
  /** Whether the scheduled auto-check is ON. */
  enabled: boolean;
  /** ISO timestamp of the next scheduled check, or null when off. */
  nextCheckAt: string | null;
  /** Last stored result per platform slug. */
  results: Record<string, HealthResult>;
}

const EMPTY: HealthState = { enabled: false, nextCheckAt: null, results: {} };

export async function getHealthState(): Promise<HealthState> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  if (!row || typeof row.value !== "object" || row.value === null) {
    return { ...EMPTY, results: {} };
  }
  const v = row.value as Partial<HealthState>;
  return {
    enabled: !!v.enabled,
    nextCheckAt: v.nextCheckAt ?? null,
    results: v.results ?? {},
  };
}

async function writeState(state: HealthState, updatedBy?: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: KEY,
      value: state as never,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: state as never,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Turn the auto health-check on/off. Enabling (re)anchors the 24h clock to now
 * (Option A); disabling clears the schedule but keeps the last results.
 * Returns the resulting state.
 */
export async function setAutoHealthCheck(
  enabled: boolean,
  updatedBy?: string,
): Promise<HealthState> {
  const cur = await getHealthState();
  const next: HealthState = {
    enabled,
    nextCheckAt: enabled
      ? new Date(Date.now() + AUTO_HEALTH_CHECK_INTERVAL_MS).toISOString()
      : null,
    results: cur.results,
  };
  await writeState(next, updatedBy);
  return next;
}

/**
 * Store a batch of per-platform results (from a scheduled run) with the current
 * time as checkedAt, merging over any existing results.
 */
export async function recordHealthResults(
  oks: Record<string, boolean>,
): Promise<void> {
  const cur = await getHealthState();
  const checkedAt = new Date().toISOString();
  const results = { ...cur.results };
  for (const [platform, ok] of Object.entries(oks)) {
    results[platform] = { ok, checkedAt };
  }
  await writeState({ ...cur, results });
}

/**
 * After a scheduled check runs, push the next one out by 24h (stays ON).
 * No-op if not currently enabled.
 */
export async function bumpNextHealthCheck(): Promise<void> {
  const cur = await getHealthState();
  if (!cur.enabled) return;
  await writeState({
    ...cur,
    nextCheckAt: new Date(Date.now() + AUTO_HEALTH_CHECK_INTERVAL_MS).toISOString(),
  });
}
