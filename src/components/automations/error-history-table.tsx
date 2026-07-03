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
// PLACEHOLDER (2026-07-03): error tracking doesn't exist yet (no runs/errors
// are stored), so nothing feeds this — with no `rows` it renders the empty
// state. Once error capture lands (Make/n8n pull + Zapier push; GHL/GHL b2b
// produce none), pass the per-error-event list into `rows` and it renders.

import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

/** One error occurrence. `errorAt` is the timestamp of that specific error. */
export interface ErrorHistoryRow {
  id: string;
  name: string;
  externalUrl: string;
  /** The integration's error description for this event (a sentence-length
   *  message). PLACEHOLDER: nothing feeds it yet, so cells show "-". */
  errorMessage?: string | null;
  errorAt: string | Date | null;
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
}: {
  /** Error events to render. Defaults to none (placeholder — not wired yet). */
  rows?: ErrorHistoryRow[];
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
        <table className="w-full min-w-[1400px] text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {/* Corner cell: pinned to BOTH the top (header) and the left
                  (frozen Name column), so it carries both the bottom-edge and
                  right-edge shadows and the highest z-index. */}
              <th className="sticky left-0 top-0 z-20 w-[600px] min-w-[600px] max-w-[600px] bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7,inset_-1px_0_0_0_#e4e4e7]">
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
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-16 text-center text-sm text-zinc-500"
                >
                  No error history yet. Error tracking for this website has not
                  been set up.
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
                      is kept and wraps within the fixed 600px via break-all. NOT
                      deduped — the same automation may repeat (one row per
                      error). */}
                  <td className="sticky left-0 z-10 w-[600px] min-w-[600px] max-w-[600px] bg-white px-3 py-2 align-top shadow-[inset_-1px_0_0_0_#e4e4e7] group-hover:bg-zinc-50">
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
                        className="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {r.externalUrl}
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
                        PLACEHOLDER: nothing feeds this yet, so it's always "-". */}
                    {r.errorMessage ? (
                      <span className="whitespace-normal break-words text-xs text-zinc-700">
                        {r.errorMessage}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
