// =============================================================
// n8n error capture — pull errored executions into automation_errors
// =============================================================
// Mirrors make-errors-sync.ts. Sweeps ALL n8n workflows, fetching each one's
// status=error executions via the n8n-client and upserting them into the
// `automation_errors` table (see [[automation-errors-foundation]]). Idempotent
// on (platform, external_error_id) — the n8n execution id — so re-runs never
// duplicate. The error message comes inline when n8n's rich `includeData` pull
// succeeds (best-effort; null otherwise, see listN8nWorkflowErrors).
//
// Triggered by the 5-min checker cron in two ways: (a) COUPLED to n8n's 24h
// Auto-refresh toggle firing (the toggle owns error capture too), and (b) the
// manual "Check for New Errors" button (a one-shot pending flag). NOT on every
// tick, and NOT on the Refresh List button. Rate-limit friendly: one call per
// workflow, throttled; the client returns [] on any non-200 (e.g. 429), so a
// throttled pass just captures fewer and the next sweep catches up.
//
// Feeds the Per Website Error History page, the Last Error column, and the Main
// Page "# Errors" / "Days since last Error" stats (all derive from the
// automation_errors table).
// =============================================================

import { db } from "@/lib/db";
import { automations, automationErrors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listN8nWorkflowErrors } from "./n8n-client";
import { platformHasApiKey } from "@/lib/automations/credentials";

const PLATFORM = "n8n";

/** Pull the workflow id out of an n8n editor URL (<base>/workflow/<id>). n8n
 *  ids are alphanumeric (not just digits), so match any non-delimiter run. */
function workflowIdFromUrl(u: string): string | null {
  const m = u.match(/\/workflow\/([^/?#]+)/);
  return m ? m[1] : null;
}

export interface N8nErrorCaptureResult {
  ok: boolean;
  workflowsPolled: number;
  errorsSeen: number;
  inserted: number;
  durationMs: number;
  skipped?: string;
}

/**
 * Capture recent n8n errors into automation_errors. Safe to run repeatedly
 * (idempotent) and on a cron. No-op (skipped) when n8n has no API key.
 */
export async function captureN8nErrors(): Promise<N8nErrorCaptureResult> {
  const start = Date.now();
  if (!platformHasApiKey(PLATFORM)) {
    return {
      ok: false,
      workflowsPolled: 0,
      errorsSeen: 0,
      inserted: 0,
      durationMs: Date.now() - start,
      skipped: "no api key",
    };
  }

  // ALL n8n workflows: a workflow that errors is not necessarily paused, and we
  // want every workflow's errors regardless of active state. One call each.
  const rows = await db
    .select({ id: automations.id, externalUrl: automations.externalUrl })
    .from(automations)
    .where(eq(automations.platform, PLATFORM));

  let workflowsPolled = 0;
  let errorsSeen = 0;
  let inserted = 0;

  for (const row of rows) {
    const workflowId = workflowIdFromUrl(row.externalUrl);
    if (!workflowId) continue;

    const errors = await listN8nWorkflowErrors(workflowId, 20);
    workflowsPolled += 1;
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

    // Throttle to stay well under n8n's rate limit (friendlier than Make, so a
    // lighter ~250ms gap). Idempotent, so a rate-limited pass just catches up.
    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    ok: true,
    workflowsPolled,
    errorsSeen,
    inserted,
    durationMs: Date.now() - start,
  };
}
