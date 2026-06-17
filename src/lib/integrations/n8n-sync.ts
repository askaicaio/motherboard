// =============================================================
// n8n ↔ Automations sync — pull workflows and upsert into motherboard
// =============================================================
// Mirrors make-sync.ts. Pulls every workflow in the n8n instance (see
// n8n-client) and upserts each into the `automations` table under platform
// "n8n", keyed on the workflow editor URL (the row's identity). Workflow name +
// active/paused status are kept in sync; n8n is treated as the source of truth
// for those fields.
//
// Upsert-only by design: a workflow deleted in n8n is NOT removed here, so
// manually-added rows are never wiped.
//
// Idempotent: re-running with no changes in n8n produces 0 created / 0 updated.
// =============================================================

import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { listN8nAutomations, getN8nLastRunAt } from "./n8n-client";

const PLATFORM = "n8n";

export interface N8nSyncResult {
  ok: boolean;
  platform: string;
  totalFromN8n: number;
  created: number;
  updated: number;
  durationMs: number;
  error?: string;
}

/**
 * Sync the n8n instance's workflows into the automations table.
 * @param createdBy admin user id to stamp on newly created rows (optional;
 *        the cron path passes none).
 */
export async function syncN8nAutomations(
  createdBy?: string,
): Promise<N8nSyncResult> {
  const start = Date.now();

  const workflows = await listN8nAutomations();

  let created = 0;
  let updated = 0;

  for (const w of workflows) {
    const url = w.url.trim();
    if (!url) continue;

    // Last run: n8n exposes it reliably via per-workflow executions. We fetch
    // it for every workflow (throttled to stay under rate limits) and treat a
    // missing value as "unknown" — we never wipe an existing timestamp, so a
    // workflow that ran then went inactive keeps its date.
    let lastRunAt: Date | null = null;
    const ts = await getN8nLastRunAt(w.id);
    if (ts) lastRunAt = new Date(ts);
    await new Promise((r) => setTimeout(r, 40));

    const [existing] = await db
      .select({
        id: automations.id,
        name: automations.name,
        status: automations.status,
        platform: automations.platform,
        lastRunAt: automations.lastRunAt,
      })
      .from(automations)
      .where(eq(automations.externalUrl, url))
      .limit(1);

    if (!existing) {
      await db.insert(automations).values({
        platform: PLATFORM,
        name: w.name,
        externalUrl: url,
        status: w.status,
        lastRunAt,
        createdBy: createdBy ?? null,
      });
      created += 1;
      continue;
    }

    // Update only when something actually changed (keeps "updated" honest).
    const patch: Partial<typeof automations.$inferInsert> = {};
    if (existing.name !== w.name) patch.name = w.name;
    if (existing.status !== w.status) patch.status = w.status;
    // A manual row for the same URL gets adopted under the n8n platform.
    if (existing.platform !== PLATFORM) patch.platform = PLATFORM;
    // Advance last_run_at only when we fetched a real, different value; never
    // overwrite a stored timestamp with null.
    if (lastRunAt && existing.lastRunAt?.getTime() !== lastRunAt.getTime()) {
      patch.lastRunAt = lastRunAt;
    }

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date();
      await db
        .update(automations)
        .set(patch)
        .where(eq(automations.id, existing.id));
      updated += 1;
    }
  }

  return {
    ok: true,
    platform: PLATFORM,
    totalFromN8n: workflows.length,
    created,
    updated,
    durationMs: Date.now() - start,
  };
}

/** Fetch the current n8n rows in the shape the per-website table expects. */
export async function getN8nRows() {
  return db
    .select({
      id: automations.id,
      name: automations.name,
      externalUrl: automations.externalUrl,
      status: automations.status,
      purpose: automations.purpose,
      lastRunAt: automations.lastRunAt,
    })
    .from(automations)
    .where(and(eq(automations.platform, PLATFORM)))
    .orderBy(automations.name);
}
