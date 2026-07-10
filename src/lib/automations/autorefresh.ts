// =============================================================
// Auto-refresh mode state (per platform) — Option A
// =============================================================
// Stores, per platform, whether scheduled auto-refresh is ON and when the
// NEXT refresh is due. Persisted in the existing `app_settings` key/value
// table under a single key (no migration needed). The state is shared
// app-wide (the automation lists are org-wide), not per-user.
//
// Option A semantics (locked with the user):
//   - Turning ON anchors the 24h clock to "now" (nextRefreshAt = now + 24h).
//     No immediate refresh — the first one fires when the clock elapses.
//   - The background checker cron (see api/cron/sync-automations) runs the
//     sync once `now >= nextRefreshAt`, then bumps nextRefreshAt by 24h.
//   - Turning OFF clears it. Turning ON again re-anchors to a fresh 24h, so
//     constant toggling can starve it (intended).
// =============================================================

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const KEY = "automations_autorefresh";
/** 24 hours — the once-a-day cadence. */
// ⚠️ DEV TEST (2026-07-10, REVERT ME): temporarily 1 minute to watch the
// auto-refresh toggle fire live. Restore to `24 * 60 * 60 * 1000` after testing.
export const AUTO_REFRESH_INTERVAL_MS = 60 * 1000;

export interface AutoRefreshState {
  enabled: boolean;
  /** ISO timestamp of the next scheduled refresh, or null when off. */
  nextRefreshAt: string | null;
}

type AutoRefreshMap = Record<string, AutoRefreshState>;

const OFF: AutoRefreshState = { enabled: false, nextRefreshAt: null };

export async function getAutoRefreshMap(): Promise<AutoRefreshMap> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  return row.value as AutoRefreshMap;
}

export async function getAutoRefreshFor(
  platform: string,
): Promise<AutoRefreshState> {
  const map = await getAutoRefreshMap();
  return map[platform] ?? { ...OFF };
}

async function writeMap(map: AutoRefreshMap, updatedBy?: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: KEY,
      value: map as never,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: map as never, updatedBy: updatedBy ?? null, updatedAt: new Date() },
    });
}

/**
 * Turn auto-refresh on/off for a platform. Enabling (re)anchors the 24h clock
 * to now (Option A). Returns the resulting state.
 */
export async function setAutoRefresh(
  platform: string,
  enabled: boolean,
  updatedBy?: string,
): Promise<AutoRefreshState> {
  const map = await getAutoRefreshMap();
  const next: AutoRefreshState = enabled
    ? {
        enabled: true,
        nextRefreshAt: new Date(Date.now() + AUTO_REFRESH_INTERVAL_MS).toISOString(),
      }
    : { ...OFF };
  map[platform] = next;
  await writeMap(map, updatedBy);
  return next;
}

/**
 * After a scheduled refresh runs, push the next one out by 24h (stays ON).
 * No-op if the platform isn't currently enabled.
 */
export async function bumpNextRefresh(platform: string): Promise<void> {
  const map = await getAutoRefreshMap();
  const cur = map[platform];
  if (!cur?.enabled) return;
  map[platform] = {
    enabled: true,
    nextRefreshAt: new Date(Date.now() + AUTO_REFRESH_INTERVAL_MS).toISOString(),
  };
  await writeMap(map);
}
