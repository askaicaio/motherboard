// =============================================================
// Automation errors — read helpers
// =============================================================
// Reads captured error events (the `automation_errors` table) for display.
// Write/capture helpers live per platform (Make first: make-errors-sync).
//
// The Per Website Error History page uses getErrorHistoryRows() to list a
// platform's errors newest-first, joined to their automation for the name +
// link the table shows.
// =============================================================

import { db } from "@/lib/db";
import { automationErrors, automations } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

/** One error row as the Error History table wants it (matches ErrorHistoryRow
 *  in error-history-table.tsx: id + name + link + message + date). */
export interface ErrorHistoryRowData {
  id: string;
  name: string;
  externalUrl: string;
  errorMessage: string | null;
  errorAt: Date | null;
}

/**
 * A platform's error events, NEWEST FIRST, joined to their automation for the
 * name + link. Feeds the Per Website Error History table. Returns [] when the
 * platform has no captured errors (the normal case until capture runs).
 */
export async function getErrorHistoryRows(
  platform: string,
): Promise<ErrorHistoryRowData[]> {
  return db
    .select({
      id: automationErrors.id,
      name: automations.name,
      externalUrl: automations.externalUrl,
      errorMessage: automationErrors.message,
      errorAt: automationErrors.occurredAt,
    })
    .from(automationErrors)
    .innerJoin(automations, eq(automationErrors.automationId, automations.id))
    .where(eq(automationErrors.platform, platform))
    .orderBy(desc(automationErrors.occurredAt));
}
