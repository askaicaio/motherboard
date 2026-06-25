// =============================================================
// GHL ↔ Automations sync — pull workflows and upsert into motherboard
// =============================================================
// NOTE: distinct from ghl-sync.ts (that is the CAMPAIGNS contact sync). This
// file is the Automations-tab workflow sync. Mirrors make-sync / n8n-sync, but
// for the two GoHighLevel subaccounts (platform = the slug: "ghl" or "ghl-b2b").
// Pulls every workflow in the subaccount (see ghl-client.listGhlAutomations)
// and upserts each into the `automations` table, keyed on the workflow deep-link
// URL (the row identity).
//
// GHL differences from Make/n8n:
//   - The platform value IS the slug passed in (two subaccounts share this code).
//   - GHL exposes NO per-run history, so we NEVER touch last_run_at (it stays "-"
//     for GHL by design — brief §3.2 / §3.4). It DOES return each workflow's
//     `updatedAt` (last edited), so we sync NAME + STATUS + LAST EDITED.
//
// Upsert-only: a workflow deleted in GHL is NOT removed here, so manually-added
// rows are never wiped. Idempotent: no changes in GHL => 0 created / 0 updated.
// =============================================================

import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { listGhlAutomations } from "./ghl-client";

export interface GhlSyncResult {
  ok: boolean;
  platform: string;
  totalFromGhl: number;
  created: number;
  updated: number;
  durationMs: number;
  error?: string;
}

/**
 * Sync a GHL subaccount's workflows into the automations table.
 * @param platform the subaccount slug ("ghl" | "ghl-b2b") — also the stored platform.
 * @param createdBy admin user id to stamp on newly created rows (optional).
 */
export async function syncGhlAutomations(
  platform: string,
  createdBy?: string,
): Promise<GhlSyncResult> {
  const start = Date.now();

  const workflows = await listGhlAutomations(platform);

  let created = 0;
  let updated = 0;

  for (const w of workflows) {
    const url = w.url.trim();
    if (!url) continue;

    // Last edited: GHL returns `updatedAt` on the workflow object itself (in the
    // list response), so no extra request. Same "never wipe with null" rule as
    // the other platforms' last_run_at.
    const lastEditedAt: Date | null = w.lastEditedAt
      ? new Date(w.lastEditedAt)
      : null;

    const [existing] = await db
      .select({
        id: automations.id,
        name: automations.name,
        status: automations.status,
        platform: automations.platform,
        lastEditedAt: automations.lastEditedAt,
      })
      .from(automations)
      .where(eq(automations.externalUrl, url))
      .limit(1);

    if (!existing) {
      await db.insert(automations).values({
        platform,
        name: w.name,
        externalUrl: url,
        status: w.status,
        lastEditedAt,
        createdBy: createdBy ?? null,
      });
      created += 1;
      continue;
    }

    // Update only when something actually changed (keeps "updated" honest).
    const patch: Partial<typeof automations.$inferInsert> = {};
    if (existing.name !== w.name) patch.name = w.name;
    if (existing.status !== w.status) patch.status = w.status;
    // A manual row for the same URL gets adopted under this platform.
    if (existing.platform !== platform) patch.platform = platform;
    // GHL has no run history, so last_run_at is never touched here.
    // Advance last_edited_at only when GHL returned a real, different value.
    if (
      lastEditedAt &&
      existing.lastEditedAt?.getTime() !== lastEditedAt.getTime()
    ) {
      patch.lastEditedAt = lastEditedAt;
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
    platform,
    totalFromGhl: workflows.length,
    created,
    updated,
    durationMs: Date.now() - start,
  };
}

/** Fetch a GHL subaccount's rows in the shape the per-website table expects. */
export async function getGhlRows(platform: string) {
  return db
    .select({
      id: automations.id,
      name: automations.name,
      externalUrl: automations.externalUrl,
      status: automations.status,
      purpose: automations.purpose,
      lastRunAt: automations.lastRunAt,
      // GHL DOES return a last-edited timestamp (workflow `updatedAt`), synced
      // above — so this column is populated for GHL (unlike Last Runtime).
      lastEditedAt: automations.lastEditedAt,
    })
    .from(automations)
    .where(and(eq(automations.platform, platform)))
    .orderBy(automations.name);
}
