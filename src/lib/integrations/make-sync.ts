// =============================================================
// Make ↔ Automations sync — pull scenarios and upsert into motherboard
// =============================================================
// Pulls every scenario in the Make org (see make-client) and upserts each
// into the `automations` table under platform "make", keyed on the scenario
// editor URL (the row's identity). Scenario name + active/paused status are
// kept in sync; Make is treated as the source of truth for those fields.
//
// Upsert-only by design: a scenario deleted in Make is NOT removed here, so
// manually-added rows are never wiped. (Pruning can be added later if wanted.)
//
// Idempotent: re-running with no changes in Make produces 0 created / 0
// updated.
// =============================================================

import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { listMakeAutomations } from "./make-client";

const PLATFORM = "make";

export interface MakeSyncResult {
  ok: boolean;
  platform: string;
  totalFromMake: number;
  created: number;
  updated: number;
  durationMs: number;
  error?: string;
}

/**
 * Sync the Make org's scenarios into the automations table.
 * @param createdBy admin user id to stamp on newly created rows (optional;
 *        the cron path passes none).
 */
export async function syncMakeAutomations(
  createdBy?: string,
): Promise<MakeSyncResult> {
  const start = Date.now();

  const scenarios = await listMakeAutomations();

  let created = 0;
  let updated = 0;

  for (const s of scenarios) {
    const url = s.url.trim();
    if (!url) continue;

    const [existing] = await db
      .select({
        id: automations.id,
        name: automations.name,
        status: automations.status,
        platform: automations.platform,
      })
      .from(automations)
      .where(eq(automations.externalUrl, url))
      .limit(1);

    if (!existing) {
      await db.insert(automations).values({
        platform: PLATFORM,
        name: s.name,
        externalUrl: url,
        status: s.status,
        createdBy: createdBy ?? null,
      });
      created += 1;
      continue;
    }

    // Update only when something actually changed (keeps "updated" honest).
    const patch: Partial<typeof automations.$inferInsert> = {};
    if (existing.name !== s.name) patch.name = s.name;
    if (existing.status !== s.status) patch.status = s.status;
    // A manual row for the same URL gets adopted under the make platform.
    if (existing.platform !== PLATFORM) patch.platform = PLATFORM;

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
    totalFromMake: scenarios.length,
    created,
    updated,
    durationMs: Date.now() - start,
  };
}

/** Fetch the current make rows in the shape the per-website table expects. */
export async function getMakeRows() {
  return db
    .select({
      id: automations.id,
      name: automations.name,
      externalUrl: automations.externalUrl,
      status: automations.status,
      purpose: automations.purpose,
    })
    .from(automations)
    .where(and(eq(automations.platform, PLATFORM)))
    .orderBy(automations.name);
}
