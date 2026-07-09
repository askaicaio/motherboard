// =============================================================
// Make error capture — pull errored executions into automation_errors
// =============================================================
// Polls ACTIVE Make automations (paused scenarios don't run, so they produce no
// new errors), fetches each scenario's status=3 log entries via the make-client,
// and upserts them into the `automation_errors` table (see
// [[automation-errors-foundation]]). Idempotent on (platform, external_error_id)
// — the Make execution `imtId` — so re-runs never duplicate. The error message
// is inline on the log entry (error.message), so it's one call per scenario.
//
// Rate-limit friendly (Make's org limit is low): one call per active scenario,
// throttled ~0.8s; make-client returns [] on any non-200 (e.g. 429), so a
// rate-limited pass just captures fewer and the next run catches up.
//
// Feeds the Per Website Error History page today; the Last Error column + Main
// Page error stats derive from the same table later.
// =============================================================

import { db } from "@/lib/db";
import { automations, automationErrors } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
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
  scenariosPolled: number;
  errorsSeen: number;
  inserted: number;
  durationMs: number;
  skipped?: string;
}

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
      errorsSeen: 0,
      inserted: 0,
      durationMs: Date.now() - start,
      skipped: "no api key",
    };
  }

  // Active scenarios only — keeps the call count bounded + under the rate limit.
  const rows = await db
    .select({ id: automations.id, externalUrl: automations.externalUrl })
    .from(automations)
    .where(
      and(eq(automations.platform, PLATFORM), eq(automations.status, "active")),
    );

  let scenariosPolled = 0;
  let errorsSeen = 0;
  let inserted = 0;

  for (const row of rows) {
    const scenarioId = scenarioIdFromUrl(row.externalUrl);
    if (!scenarioId) continue;

    const errors = await listMakeScenarioErrors(scenarioId, 20);
    scenariosPolled += 1;
    errorsSeen += errors.length;

    for (const e of errors) {
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

    // Throttle to respect Make's org rate limit (~1 call/sec).
    await new Promise((r) => setTimeout(r, 800));
  }

  return {
    ok: true,
    scenariosPolled,
    errorsSeen,
    inserted,
    durationMs: Date.now() - start,
  };
}
