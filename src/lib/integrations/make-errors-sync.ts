// =============================================================
// Make error capture — pull errored executions into automation_errors
// =============================================================
// Sweeps ALL Make scenarios (a scenario that errored on a connection is usually
// auto-paused by Make, so active-only would miss it), fetching each scenario's
// status=3 log entries via the make-client and upserting them into the
// `automation_errors` table (see [[automation-errors-foundation]]). Idempotent
// on (platform, external_error_id) — the Make execution `imtId` — so re-runs
// never duplicate. The error message is inline on the log entry (error.message),
// so it's one call per scenario.
//
// Triggered by the 5-min checker cron in two ways: (a) COUPLED to a platform's
// 24h Auto-refresh toggle firing (the toggle owns error capture too), and (b)
// the manual "Check for New Errors" button (a one-shot pending flag). NOT on
// every tick, and NOT on the Refresh List button. Rate-limit aware: one call
// per scenario, throttled ~1.5s; make-client retries a 429 with back-off and
// reports `rate_limited` when it still can't read a scenario, so this sweep can
// count what it MISSED (vs silently under-counting). A soft time budget stops
// the sweep before the cron's 300s ceiling so it returns a report instead of
// being killed mid-loop. Anything missed is picked up by the next sweep
// (idempotent upsert), and the honest counters say how much was missed + why.
//
// Feeds the Per Website Error History page, the Last Error column, and the Main
// Page "# Errors" stat (all derive from the automation_errors table).
// =============================================================

import { db } from "@/lib/db";
import { automations, automationErrors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listMakeScenarioErrors } from "./make-client";
import { platformHasApiKey } from "@/lib/automations/credentials";

const PLATFORM = "make";

/** Pull the scenario id out of a Make editor URL (.../scenarios/<id>/edit). */
function scenarioIdFromUrl(u: string): string | null {
  const m = u.match(/\/scenarios\/(\d+)\//);
  return m ? m[1] : null;
}

export interface MakeErrorCaptureResult {
  ok: boolean;
  /** Scenarios we attempted a fetch for this pass. */
  scenariosPolled: number;
  /** Of those, how many returned cleanly (status ok). */
  scenariosOk: number;
  /** Of those, how many were still rate-limited after retries — their errors
   *  are UNKNOWN this pass (NOT known-empty). >0 explains a partial capture. */
  rateLimited: number;
  /** Of those, how many failed for another reason (non-200, parse). */
  failed: number;
  /** Scenarios NOT polled because the soft time budget ran out (deferred to the
   *  next sweep). >0 also explains a partial capture. */
  notPolled: number;
  errorsSeen: number;
  inserted: number;
  durationMs: number;
  skipped?: string;
}

/** Stop starting new scenarios after this long, leaving headroom under the
 *  cron's maxDuration=300s for the final upserts + response. A killed function
 *  reports nothing; stopping early reports honest counters. */
const SOFT_TIME_BUDGET_MS = 240 * 1000;

/**
 * Capture recent Make errors into automation_errors. Safe to run repeatedly
 * (idempotent) and on a cron. No-op (skipped) when Make has no API key.
 */
export async function captureMakeErrors(): Promise<MakeErrorCaptureResult> {
  const start = Date.now();
  if (!platformHasApiKey(PLATFORM)) {
    return {
      ok: false,
      scenariosPolled: 0,
      scenariosOk: 0,
      rateLimited: 0,
      failed: 0,
      notPolled: 0,
      errorsSeen: 0,
      inserted: 0,
      durationMs: Date.now() - start,
      skipped: "no api key",
    };
  }

  // ALL Make scenarios (not active-only): connection/auth errors make Make
  // auto-DISABLE the scenario, so the erroring ones are usually paused — an
  // active-only filter would skip exactly the scenarios that have errors. This
  // runs at most once per 24h refresh cycle (or on a manual check), so the full
  // sweep is infrequent.
  const rows = await db
    .select({ id: automations.id, externalUrl: automations.externalUrl })
    .from(automations)
    .where(eq(automations.platform, PLATFORM));

  let scenariosPolled = 0;
  let scenariosOk = 0;
  let rateLimited = 0;
  let failed = 0;
  let notPolled = 0;
  let errorsSeen = 0;
  let inserted = 0;

  const deadline = start + SOFT_TIME_BUDGET_MS;

  for (let i = 0; i < rows.length; i++) {
    // Out of time budget — defer the rest to the next sweep and report how many
    // we didn't reach (the idempotent upsert means nothing is lost, just later).
    if (Date.now() > deadline) {
      notPolled = rows.length - i;
      break;
    }

    const row = rows[i];
    const scenarioId = scenarioIdFromUrl(row.externalUrl);
    if (!scenarioId) continue;

    const result = await listMakeScenarioErrors(scenarioId, 20);
    scenariosPolled += 1;
    if (result.status === "ok") scenariosOk += 1;
    else if (result.status === "rate_limited") rateLimited += 1;
    else failed += 1;
    errorsSeen += result.errors.length;

    for (const e of result.errors) {
      const insertedRows = await db
        .insert(automationErrors)
        .values({
          automationId: row.id,
          platform: PLATFORM,
          externalErrorId: e.externalErrorId,
          message: e.message,
          occurredAt: new Date(e.occurredAt),
        })
        .onConflictDoNothing({
          target: [automationErrors.platform, automationErrors.externalErrorId],
        })
        .returning({ id: automationErrors.id });
      if (insertedRows.length > 0) inserted += 1;
    }

    // Throttle to respect Make's org rate limit (~1 call per 1.5s). A full
    // sweep of ~115 scenarios is ~3 min — fine on the cron (maxDuration 300s).
    await new Promise((r) => setTimeout(r, 1500));
  }

  return {
    ok: true,
    scenariosPolled,
    scenariosOk,
    rateLimited,
    failed,
    notPolled,
    errorsSeen,
    inserted,
    durationMs: Date.now() - start,
  };
}
