"use client";

// Per Website Error History table (3-column error log). Lists a platform's
// automation errors in CHRONOLOGICAL order, latest errors on TOP.
//
// Reuses the Per Website Page table's size + scrolling shell verbatim: a
// bounded scroll area (max-h-[70vh] overflow-auto) so only the list scrolls;
// a sticky header (Option B, opaque bg + inset bottom-edge shadow); and a
// min-w that drives horizontal scroll once the columns exceed the card, with
// the "Name" column frozen (sticky left-0) so the automation's identity stays
// in view while scrolling sideways. Only the COLUMNS differ from that table.
//
// Columns: Name (frozen; the automation's link sits BENEATH the name in the
// same cell, exactly like the Per Website Page table — not a separate column) ·
// Error Date (red, MM-DD-YYYY) · Error Message (left-aligned, wraps full
// sentences).
// Key difference from the Per Website Page table: that table is one row per
// automation (deduped by link identity); THIS one is ONE ROW PER ERROR EVENT
// (not deduped), so the same automation can appear on many rows.
//
// EDIT MODE: when `editMode` is on, each row gets a delete button (a trailing
// column); clicking calls `onDelete(id)`. Delete-only — no add/edit dialogs.

import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Trash2 } from "lucide-react";

/** One error occurrence. `errorAt` is the timestamp of that specific error. */
export interface ErrorHistoryRow {
  id: string;
  name: string;
  externalUrl: string;
  /** The integration's error description for this event (a sentence-length
   *  message). Fed by capture (Make/n8n); may contain HTML (n8n), which is
   *  rendered as plain text via toPlainText. Null cells show "-". */
  errorMessage?: string | null;
  errorAt: string | Date | null;
}

/** Render an error message as plain text. Some integrations (n8n) embed HTML in
 *  their error strings — e.g. `... <a href="...">Learn more</a> ...` — which we
 *  must NOT render as markup (the text comes from a third-party API: an XSS
 *  risk). So strip tags, decode the few common entities, and collapse
 *  whitespace. Plain messages (Make) pass through unchanged. */
function toPlainText(message: string): string {
  const withoutTags = message.replace(/<[^>]*>/g, "");
  const decoded = withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&"); // decode &amp; last so "&amp;lt;" -> "&lt;"
  return decoded.replace(/\s+/g, " ").trim();
}

/** MM-DD-YYYY, or "-" when empty/invalid. Matches the table's other date cells.
 *  Tolerant of both a Date and an ISO string. */
function formatDateCell(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

export function ErrorHistoryTable({
  rows = [],
  editMode = false,
  onDelete,
  deletingId = null,
  hasQuery = false,
}: {
  /** Error events to render (sorted newest-first internally). Already filtered
   *  by the parent's search when a query is active. */
  rows?: ErrorHistoryRow[];
  /** When true, show a delete button per row (delete-only edit mode). */
  editMode?: boolean;
  /** Called with the row id when its delete button is clicked. */
  onDelete?: (id: string) => void;
  /** Row currently being deleted (its button is disabled meanwhile). */
  deletingId?: string | null;
  /** True when a search query is active, so an empty result reads as "no match"
   *  instead of "no errors yet" (mirrors the Per Website Page table). */
  hasQuery?: boolean;
}) {
  // Chronological, latest on top. Rows with no/invalid date sink to the bottom
  // (mirrors the date-sort behaviour of the Per Website Page table).
  const time = (v: string | Date | null | undefined): number | null => {
    if (!v) return null;
    const t = new Date(v).getTime();
    return isNaN(t) ? null : t;
  };
  const sorted = rows.slice().sort((a, b) => {
    const ta = time(a.errorAt);
    const tb = time(b.errorAt);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta; // descending → latest error first
  });

  return (
    <Card>
      <CardContent className="max-h-[70vh] overflow-auto p-0">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {/* Corner cell: pinned to BOTH the top (header) and the left
                  (frozen Name column), so it carries both the bottom-edge and
                  right-edge shadows and the highest z-index. */}
              <th className="sticky left-0 top-0 z-20 w-[400px] min-w-[400px] max-w-[400px] bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7,inset_-1px_0_0_0_#e4e4e7]">
                Name
              </th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                Error Date
              </th>
              {/* Error Message is the "greedy" column (w-full): it soaks up all
                  the leftover table width, so the auto-width Error Date column
                  hugs its short date content instead of splitting the slack. */}
              <th className="sticky top-0 z-10 w-full bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7]">
                Error Message
              </th>
              {editMode && (
                <th className="sticky top-0 z-10 w-12 whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={editMode ? 4 : 3}
                  className="px-3 py-16 text-center text-sm text-zinc-500"
                >
                  {hasQuery
                    ? "No errors match your search."
                    : "No error history yet. Error tracking for this website has not been set up."}
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.id} className="group border-t hover:bg-zinc-50">
                  {/* Frozen Name column (sticky left-0), same treatment as the
                      Per Website Page table: opaque bg + group-hover so it
                      doesn't look detached from the hovered row, + a right-edge
                      shadow separating it from the scrolling column. Name on top;
                      the automation's link sits BENEATH it (subdued), same as the
                      Per Website Page table — not a separate column. The full URL
                      is stored/clickable but DISPLAYS on a single truncated line
                      within the fixed 400px, matching the Per Website table. The
                      ellipsis is on the LEFT (`[direction:rtl] text-left`) so the
                      END of the link (the workflow ID) stays visible. NOT deduped
                      — the same automation may repeat (one row per error). */}
                  <td className="sticky left-0 z-10 w-[400px] min-w-[400px] max-w-[400px] bg-white px-3 py-2 align-top shadow-[inset_-1px_0_0_0_#e4e4e7] group-hover:bg-zinc-50">
                    <div className="font-medium text-zinc-900">
                      {r.name || (
                        <span className="font-normal text-zinc-400">
                          (unnamed)
                        </span>
                      )}
                    </div>
                    {r.externalUrl && (
                      <a
                        href={r.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={r.externalUrl}
                        className="mt-0.5 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="min-w-0 truncate [direction:rtl] text-left">
                          {r.externalUrl}
                        </span>
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-center">
                    {/* Error Date: red MM-DD-YYYY, matching the "Last Error"
                        column's visual format. No fixed width — it hugs its short
                        date content because the Error Message column is greedy
                        (w-full) and soaks up all the leftover table width. */}
                    {r.errorAt ? (
                      <span className="text-xs tabular-nums text-red-600">
                        {formatDateCell(r.errorAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-left">
                    {/* Error Message: the integration's error description,
                        LEFT-aligned. Wraps (whitespace-normal + break-words) so
                        full sentences read tactfully instead of being clipped or
                        blowing out the row width; the row grows to fit. A very
                        long single "word"/URL still breaks rather than overflow.
                        Rendered as plain text (toPlainText) — n8n embeds HTML in
                        its messages, which we must not render as markup. */}
                    {r.errorMessage ? (
                      <span className="whitespace-normal break-words text-xs text-zinc-700">
                        {toPlainText(r.errorMessage)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                  {editMode && (
                    <td className="px-3 py-2 align-top text-center">
                      {/* Delete-only edit mode: remove this error row. Hard
                          delete (may re-appear on the next sweep if still in
                          Make's logs — user's choice). */}
                      <button
                        type="button"
                        onClick={() => onDelete?.(r.id)}
                        disabled={deletingId === r.id}
                        aria-label="Delete this error"
                        className="inline-flex items-center rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
