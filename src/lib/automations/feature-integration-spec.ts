// Shared, PURE spec for the Automations Feature Integration checklist tables.
// No db / server-only imports here, so BOTH the client component (rendering the
// tables) and the server (validating a cell key before saving) can import it.
//
// Two tables, each a checklist: the corner label names the table, the columns
// are the automation websites (AUTOMATION_SITES), and each row is a feature.
// Every non-header cell is a boolean (checked = that feature is integrated for
// that website).

import { AUTOMATION_SITES } from "./sites";

export interface ChecklistRow {
  /** Stable key used in the stored cell key (do not rename casually). */
  key: string;
  /** Row label shown in the leftmost column. */
  label: string;
}

export interface ChecklistTableSpec {
  /** Stable table id used in the stored cell key. */
  id: string;
  /** Top-left corner label (also names the table). */
  cornerLabel: string;
  rows: ChecklistRow[];
}

export const FEATURE_INTEGRATION_TABLES: ChecklistTableSpec[] = [
  {
    id: "refresh",
    cornerLabel: "Refresh List",
    rows: [
      { key: "name-link", label: "Name and Link" },
      { key: "status", label: "Status" },
      { key: "last-edited", label: "Last Edited" },
      { key: "last-runtime", label: "Last Runtime" },
    ],
  },
  {
    id: "error",
    cornerLabel: "Error Tracking",
    rows: [
      { key: "name-link", label: "Name and Link" },
      { key: "error-date", label: "Error Date" },
      { key: "error-message", label: "Error Message" },
      { key: "last-error", label: "Last Error" },
    ],
  },
];

/** Build the stored key for one checklist cell: `<tableId>:<rowKey>:<slug>`. */
export function cellKey(tableId: string, rowKey: string, slug: string): string {
  return `${tableId}:${rowKey}:${slug}`;
}

/** Validate a cell key server-side before persisting, so the stored map can
 *  only ever hold real (table, row, website) combinations. */
export function isValidCellKey(key: string): boolean {
  const parts = key.split(":");
  if (parts.length !== 3) return false;
  const [tableId, rowKey, slug] = parts;
  const table = FEATURE_INTEGRATION_TABLES.find((t) => t.id === tableId);
  if (!table) return false;
  if (!table.rows.some((r) => r.key === rowKey)) return false;
  return AUTOMATION_SITES.some((s) => s.slug === slug);
}
