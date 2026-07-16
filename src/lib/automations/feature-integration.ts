// =============================================================
// Automations Feature Integration checklist state
// =============================================================
// Stores the two checklist tables' checkbox states. Persisted in the existing
// `app_settings` key/value table under a single key (NO migration needed, same
// approach as automations_autorefresh). State is shared app-wide (the checklist
// describes org-wide integration status), not per-user.
//
// Storage shape: a flat map of `<tableId>:<rowKey>:<slug>` -> true. Only TRUE
// cells are stored; an absent key means false. This keeps the blob compact and
// makes "unchecked" the natural default.
// =============================================================

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isValidCellKey } from "./feature-integration-spec";

const KEY = "automations_feature_integration";

/** Map of checked cell keys -> true. Absent key = false. */
export type FeatureIntegrationMap = Record<string, boolean>;

export async function getFeatureIntegrationMap(): Promise<FeatureIntegrationMap> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  return row.value as FeatureIntegrationMap;
}

async function writeMap(
  map: FeatureIntegrationMap,
  updatedBy?: string,
): Promise<void> {
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
      set: {
        value: map as never,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Set a single checklist cell on/off. Stores only true cells (deletes on
 * false), so the default for any untouched cell stays false. Rejects unknown
 * cell keys. Returns the resulting full map.
 */
export async function setFeatureIntegrationCell(
  key: string,
  value: boolean,
  updatedBy?: string,
): Promise<FeatureIntegrationMap> {
  if (!isValidCellKey(key)) {
    throw new Error(`Invalid feature-integration cell key: ${key}`);
  }
  const map = await getFeatureIntegrationMap();
  if (value) map[key] = true;
  else delete map[key];
  await writeMap(map, updatedBy);
  return map;
}
