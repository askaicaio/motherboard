// =============================================================
// Editable status for a design version
// =============================================================
// ⭐ WHY THIS FILE EXISTS. Every version's status is DERIVED from flags in
// `versions.ts`, which is source code: `official`, `shipped`, `parked`,
// `archived`. **A page cannot write to a TypeScript file**, so making the
// status clickable needed somewhere to put the answer.
//
// 📌 STORED IN `app_settings` UNDER ONE KEY, no migration, exactly like the
// Feature Integration checklist next door (`feature-integration.ts`) and like
// `automations_autorefresh` before it. Shared app-wide, not per user: where a
// design version stands is a fact about the project, not a preference.
//
// Storage shape: `{ "<href>": "<status>" }`. **An absent href means "use what
// the registry derives"**, which keeps the blob tiny and makes the code the
// default rather than a thing to keep in sync.
//
// ⚠️⚠️ AN OVERRIDE WINS OUTRIGHT over the derived status, including over
// `shipped`. That is deliberate: you clicked it, so it should say what you
// clicked. **The "runs X" tail is NOT part of the status** - it comes from
// `v.shipped` and keeps showing regardless, so a row can honestly read
// "archived" and "runs Dropdown Configuration" at once, which is a real
// combination two versions are already in.
//
// 🛑 CHANGING A STATUS CHANGES A WORD AND NOTHING ELSE. Nothing filters on
// `archived` any more (the last filter that did went on 2026-09-30), the
// grouping is by `family`, and the order is the registry's. **If a status ever
// starts deciding what renders, this becomes a much bigger feature than it
// looks.**
// =============================================================

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  AUTOMATION_VERSIONS,
  EDITABLE_VERSION_STATUSES,
  type VersionStatusKey,
} from "./versions";

const KEY = "automations_version_status";

/** href -> status. An absent href means the registry's derived status. */
export type VersionStatusOverrides = Record<string, VersionStatusKey>;

export async function getVersionStatusOverrides(): Promise<VersionStatusOverrides> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  return row.value as VersionStatusOverrides;
}

async function writeOverrides(
  overrides: VersionStatusOverrides,
  updatedBy?: string,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: KEY,
      value: overrides as never,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: overrides as never,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      },
    });
}

/** True while `href` is a registered version. **Validated server-side before
 *  anything is stored**, so the blob can only ever hold real routes. */
export function isVersionHref(href: string): boolean {
  return AUTOMATION_VERSIONS.some((v) => v.href === href);
}

/** True while `status` is one a person is allowed to pick. See
 *  `EDITABLE_VERSION_STATUSES` for why `live` is not on that list. */
export function isEditableStatus(status: string): status is VersionStatusKey {
  return (EDITABLE_VERSION_STATUSES as readonly string[]).includes(status);
}

/**
 * Set one version's status, or clear it back to the registry's own answer by
 * passing `null`. **Clearing deletes the key rather than storing a sentinel**,
 * so an untouched version costs nothing and the default lives in exactly one
 * place. Returns the resulting full map.
 */
export async function setVersionStatusOverride(
  href: string,
  status: VersionStatusKey | null,
  updatedBy?: string,
): Promise<VersionStatusOverrides> {
  if (!isVersionHref(href)) {
    throw new Error(`Unknown design version: ${href}`);
  }
  if (status !== null && !isEditableStatus(status)) {
    throw new Error(`Status cannot be set to: ${status}`);
  }
  const overrides = await getVersionStatusOverrides();
  if (status === null) delete overrides[href];
  else overrides[href] = status;
  await writeOverrides(overrides, updatedBy);
  return overrides;
}
