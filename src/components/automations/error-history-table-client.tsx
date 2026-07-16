"use client";

// Client shell for the Per Website Error History page: owns the Edit-mode
// toggle + delete state, and renders the page header (brand icon + title +
// "Check for New Errors" button) alongside the error-log table.
//
// Edit mode (delete-only): the header toggle (Pencil + Switch, matching the Per
// Website Page) reveals a delete button per row. Deleting hard-removes the row
// (DELETE /api/automations/errors/[id]) with an optimistic update. No add/edit
// dialogs; delete is the only edit-mode action here.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Pencil, Search } from "lucide-react";
import {
  ErrorHistoryTable,
  type ErrorHistoryRow,
} from "./error-history-table";
import { CheckErrorsButton } from "./check-errors-button";
import { AutoRefreshToggle } from "./auto-refresh-toggle";

interface ErrorHistorySite {
  slug: string;
  label: string;
  icon: string;
  iconColor?: string;
}

/** How often the page re-reads its own error rows while open. Sweeps take
 *  minutes to land, so this only needs to be responsive-enough, not fast. */
const ROW_POLL_INTERVAL_MS = 20_000;

export function ErrorHistoryTableClient({
  site,
  canCapture = false,
  hasApiKey = false,
  autoRefresh = { enabled: false, nextRefreshAt: null },
  initialRows = [],
}: {
  site: ErrorHistorySite;
  /** True only for platforms whose error capture is built (Make). */
  canCapture?: boolean;
  /** Whether this platform has an API integration (gates the auto-refresh toggle). */
  hasApiKey?: boolean;
  /** Shared per-platform auto-refresh state (same one the Per Website Page uses). */
  autoRefresh?: { enabled: boolean; nextRefreshAt: string | null };
  initialRows?: ErrorHistoryRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [editMode, setEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Search filters by automation NAME only, matching the Per Website Page's
  // search bar (deliberately not the link or the error message). Client-side
  // over the already-loaded rows, so it's instant and stays out of the poll's
  // way (the poll refreshes the full `rows`; the filter derives from them).
  const [query, setQuery] = useState("");

  // Re-fetch this platform's captured errors and update the table in place.
  // `no-store` so the browser can't hand back a stale cached response between
  // polls (a full page reload always re-runs the server component, which is why
  // the manual refresh worked; the client poll needs no-store to match).
  const refreshErrorRows = useCallback(async () => {
    try {
      const res = await fetch(`/api/automations/errors?platform=${site.slug}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const { errors } = await res.json();
      if (Array.isArray(errors)) setRows(errors as ErrorHistoryRow[]);
    } catch {
      // transient; the next poll tick retries
    }
  }, [site.slug]);

  // Keep the table current on ITS OWN, independent of the auto-refresh toggle
  // and of whatever kicked off a sweep (the manual "Check for New Errors" button
  // OR the toggle; Make OR n8n). Error capture runs server-side on the cron and
  // its rows land a few minutes later at a time that varies, so we STEADILY
  // re-read while the page is open instead of leaning on any single trigger to
  // push the update.
  //
  // ⚠️ This decoupling is load-bearing — do NOT re-couple row-refresh to the
  // toggle. Every past "rows don't show up" regression (#164/#165/#166) came
  // from making row updates a passenger on the auto-refresh toggle's poll, which
  // (a) left the MANUAL button path — which is not the toggle — with no live
  // update at all, and (b) made the toggle path hostage to sweep timing. Row
  // display is this page's own concern; the toggle just runs its countdown.
  useEffect(() => {
    // Pause while editing: an in-flight optimistic delete must not be undone by
    // a poll re-adding the row (deletes only happen in edit mode).
    if (editMode) return;
    const tick = () => {
      // Skip when the tab is hidden — no point fetching for an unseen page.
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshErrorRows();
    };
    const id = setInterval(tick, ROW_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [editMode, refreshErrorRows]);

  const handleDelete = async (id: string) => {
    if (deletingId) return; // one at a time
    setDeletingId(id);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id)); // optimistic remove
    try {
      const res = await fetch(`/api/automations/errors/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setRows(prev); // roll back on failure
      toast.error("Couldn't delete that error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  // Name-only filter (Column 1). Never mutates `rows`. The table still sorts
  // the result newest-first internally.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);
  const hasQuery = query.trim().length > 0;

  return (
    <>
      {/* Header row: title block on the left; Edit-mode toggle + "Check for New
          Errors" on the right (same spot as the Per Website Page header). */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {/* Website brand logo to the LEFT of the title (tinted SVG via CSS
                mask when iconColor is set, else a full-colour image). */}
            {site.iconColor ? (
              <span
                aria-hidden
                className="h-8 w-8 shrink-0"
                style={{
                  backgroundColor: site.iconColor,
                  maskImage: `url(${site.icon})`,
                  WebkitMaskImage: `url(${site.icon})`,
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.icon}
                alt=""
                className="h-8 w-8 shrink-0 object-contain"
              />
            )}
            <h1 className="text-2xl font-semibold tracking-tight">
              {site.label} Error History
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Error history for {site.label} automations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh list toggle, a copy of the Per Website Page one, to the
              LEFT of "Check for New Errors". Shared per-platform state, so it
              mirrors the Per Website toggle and (since error capture is coupled
              to it) is the on/off switch for error capture too. NOTE: row
              refresh is intentionally NOT wired here — the page polls its own
              rows independently (see the effect above), so a manual sweep (with
              the toggle off) still updates. The toggle just runs its countdown. */}
          <AutoRefreshToggle
            platform={site.slug}
            hasApiKey={hasApiKey}
            autoRefresh={autoRefresh}
          />
          <CheckErrorsButton platform={site.slug} canCapture={canCapture} />
          {/* Edit mode (delete-only), styled like the Per Website Page toggle;
              sits to the RIGHT of the Check for New Errors button. */}
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Search bar, searches the automation NAME only. Same markup + styling
            as the Per Website Page search bar (Search icon inset left, pl-8
            Input, max-w-sm). */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search errors by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        <ErrorHistoryTable
          rows={filtered}
          editMode={editMode}
          onDelete={handleDelete}
          deletingId={deletingId}
          hasQuery={hasQuery}
        />
      </div>
    </>
  );
}
