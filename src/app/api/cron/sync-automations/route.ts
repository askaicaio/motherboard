// =============================================================
// Cron: the background checker for the Automations tab
// =============================================================
// Runs frequently (see vercel.json). On each tick it drives these Option-A timers:
//
//   1. Auto-refresh (per platform): for any platform ENABLED and whose
//      nextRefreshAt has passed, run that platform's sync, then push the next
//      refresh out by 24h. This is the engine behind the per-website
//      "Auto-refresh mode" toggle.
//   1b. Error capture (COUPLED to #1): when a platform's 24h refresh fires and
//      the platform supports error capture (Make), sweep its errors in the SAME
//      cycle. So the Auto-refresh toggle owns BOTH the list refresh and error
//      capture — toggle OFF = neither runs. (The manual "Check for New Errors"
//      button is the toggle-independent escape hatch, handled below via a
//      one-shot pending flag.)
//   2. Auto-API health check (single global): if enabled and nextCheckAt has
//      passed, live-verify EVERY platform's API credential, store the results
//      (so the Main Page cards show last-known status), then push the next check
//      out by 24h. This is the engine behind the Main Page "Auto-API health
//      check" toggle.
//
// The toggles only set a flag + a due time; this cron performs the actual work.
// Precision = this cron's interval (fires at the first tick at/after due).
//
// Auth: Vercel passes Authorization: Bearer <CRON_SECRET>; reject others.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAutoRefreshMap, bumpNextRefresh } from "@/lib/automations/autorefresh";
import {
  getHealthState,
  recordHealthResults,
  bumpNextHealthCheck,
} from "@/lib/automations/health";
import { verifyAllPlatforms } from "@/lib/automations/verify";
import { isSyncablePlatform, isErrorCapturePlatform } from "@/lib/automations/sites";
import { syncMakeAutomations } from "@/lib/integrations/make-sync";
import { captureMakeErrors } from "@/lib/integrations/make-errors-sync";
import { isManualSweepPending, markErrorSweepDone } from "@/lib/automations/errors";
import { syncN8nAutomations } from "@/lib/integrations/n8n-sync";
import { syncGhlAutomations } from "@/lib/integrations/ghl-automations-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // No secret configured = allow in dev only.
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

/** Run the sync for a platform. Returns null for platforms without a sync. */
async function runSync(platform: string) {
  switch (platform) {
    case "make":
      return syncMakeAutomations();
    case "n8n":
      return syncN8nAutomations();
    case "ghl":
    case "ghl-b2b":
      return syncGhlAutomations(platform);
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const map = await getAutoRefreshMap();
  const now = Date.now();
  const results: Array<Record<string, unknown>> = [];

  // Set when an error-capture platform's 24h refresh fires this tick, so the
  // coupled error sweep runs below (Auto-refresh toggle owns error capture too).
  let errorCaptureDue = false;

  for (const [platform, state] of Object.entries(map)) {
    if (!state?.enabled || !state.nextRefreshAt) continue;
    if (!isSyncablePlatform(platform)) continue;
    if (new Date(state.nextRefreshAt).getTime() > now) continue; // not due yet

    // This platform's refresh is firing this tick; if it supports error capture,
    // couple the error sweep to it (runs once, below).
    if (isErrorCapturePlatform(platform)) errorCaptureDue = true;

    try {
      const result = await runSync(platform);
      await bumpNextRefresh(platform); // schedule the next day
      results.push({ platform, ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[auto-refresh] ${platform} failed:`, message);
      // Bump anyway so a persistent failure doesn't hammer the API every tick;
      // the manual "Refresh List" button is always available as a fallback.
      await bumpNextRefresh(platform);
      results.push({ platform, ok: false, error: message });
    }
  }

  // Auto-API health check (single global timer): when due, verify every
  // platform and store the results for the Main Page cards.
  let healthRan = false;
  const health = await getHealthState();
  if (
    health.enabled &&
    health.nextCheckAt &&
    new Date(health.nextCheckAt).getTime() <= now
  ) {
    try {
      const oks = await verifyAllPlatforms();
      await recordHealthResults(oks);
      results.push({ task: "health-check", ok: true, oks });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[health-check] failed:`, message);
      results.push({ task: "health-check", ok: false, error: message });
    }
    // Bump regardless (success or failure) so a persistent failure doesn't
    // re-run every tick; the manual button is always available.
    await bumpNextHealthCheck();
    healthRan = true;
  }

  // Error capture (Make): a full sweep of ALL scenarios. Runs when EITHER
  //   (a) a platform's 24h auto-refresh fired this tick (errorCaptureDue) — the
  //       coupled, toggle-driven path; or
  //   (b) the manual "Check for New Errors" button queued a one-shot sweep
  //       (manualPending) — the toggle-independent escape hatch.
  // One sweep per tick either way; markErrorSweepDone() clears the manual flag
  // and stamps lastSweptAt (also satisfying a pending manual request when the
  // auto path ran). Always mark done, even on failure, so it can't hammer Make.
  let manualPending = false;
  try {
    manualPending = await isManualSweepPending();
  } catch (err) {
    // The pending check itself failed (e.g. DB read) — skip manual this tick.
    console.error(`[make-error-capture] pending-check failed:`, err);
  }
  if (errorCaptureDue || manualPending) {
    try {
      const errorCapture = await captureMakeErrors();
      results.push({
        task: "make-error-capture",
        trigger: errorCaptureDue ? "auto" : "manual",
        ...errorCapture,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[make-error-capture] failed:`, message);
      results.push({ task: "make-error-capture", ok: false, error: message });
    } finally {
      await markErrorSweepDone();
    }
  }

  return NextResponse.json({
    ok: true,
    checked: Object.keys(map).length,
    ran: results.length,
    healthRan,
    results,
  });
}
