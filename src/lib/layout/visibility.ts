// =============================================================
// Per-department tab visibility — config store
// =============================================================
// Persists the department → hidden-tabs map in the existing app_settings
// table (key/value jsonb), so no new table is needed.
// =============================================================

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  DEPARTMENT_VISIBILITY_SETTINGS_KEY,
  type DepartmentTabVisibility,
} from "./nav";

export async function getDepartmentTabVisibility(): Promise<DepartmentTabVisibility> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, DEPARTMENT_VISIBILITY_SETTINGS_KEY))
      .limit(1);
    if (!row) return {};
    return (row.value as DepartmentTabVisibility) ?? {};
  } catch {
    // Never let a settings read break the dashboard shell.
    return {};
  }
}

export async function setDepartmentTabVisibility(
  config: DepartmentTabVisibility,
  updatedBy: string | null,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: DEPARTMENT_VISIBILITY_SETTINGS_KEY,
      value: config,
      updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: config, updatedBy, updatedAt: new Date() },
    });
}
