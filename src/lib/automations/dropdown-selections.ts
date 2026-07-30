// Read helper for MULTI-select dropdown columns (Automation Tags first).
//
// Resolves an automation's selected choices for one column from the generic
// junction (automation_dropdown_selections) joined to the choice rows, grouped
// by automation id. Used by the Per Website + View All Lists page loaders to
// hand each row its set of chips. The column is identified by the choice's own
// column_key, so the same junction serves every multi-select column.

import { db } from "@/lib/db";
import {
  automationDropdownSelections,
  automationDropdownChoices,
} from "@/lib/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { SelectedChoice } from "./dropdown-config";

/**
 * Selected choices for `columnKey`, grouped by automation id. Pass a platform's
 * automation ids to scope the read (Per Website page); omit to load across all
 * automations (View All Lists). Choices come back alphabetical by value within
 * each automation.
 */
export async function getSelectionsByColumn(
  columnKey: string,
  automationIds?: string[],
): Promise<Map<string, SelectedChoice[]>> {
  const map = new Map<string, SelectedChoice[]>();
  // An explicit empty id list means "no automations" → nothing to load (and
  // avoids an `IN ()` query).
  if (automationIds && automationIds.length === 0) return map;

  const rows = await db
    .select({
      automationId: automationDropdownSelections.automationId,
      id: automationDropdownChoices.id,
      value: automationDropdownChoices.value,
      badgeColor: automationDropdownChoices.badgeColor,
      textColor: automationDropdownChoices.textColor,
    })
    .from(automationDropdownSelections)
    .innerJoin(
      automationDropdownChoices,
      eq(automationDropdownSelections.choiceId, automationDropdownChoices.id),
    )
    .where(
      and(
        eq(automationDropdownChoices.columnKey, columnKey),
        automationIds
          ? inArray(automationDropdownSelections.automationId, automationIds)
          : undefined,
      ),
    )
    .orderBy(asc(automationDropdownChoices.value));

  for (const r of rows) {
    const list = map.get(r.automationId);
    const entry: SelectedChoice = {
      id: r.id,
      value: r.value,
      badgeColor: r.badgeColor,
      textColor: r.textColor,
    };
    if (list) list.push(entry);
    else map.set(r.automationId, [entry]);
  }
  return map;
}
