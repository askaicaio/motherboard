"use client";

// Per Website Page, header (auto-refresh toggle + "Refresh List" + edit-mode
// toggle + "+ New Workflow"), search, and the automations table. The Name cell
// shows the name with the automation's link beneath it (the link is still its
// identity; it's just no longer a separate column). Search filters by NAME only.
//
// Edit mode (the toggle, top-right): when ON it reveals the "+ New Workflow"
// button and makes table rows clickable (click a row to edit it). When OFF
// the table is read-only. Add/Edit happen in the WorkflowDialog.
//
// Auto-refresh mode (the toggle, far left of the toolbar): Option A. Turning
// it ON anchors a 24h countdown to now; the background cron refreshes the list
// once it elapses, then resets the countdown. Re-toggling restarts the 24h.
// Blocked (with a red error) on platforms with no API integration.

import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ExternalLink,
  Plus,
  Pencil,
  RefreshCw,
  Clock,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WorkflowDialog } from "./workflow-dialog";

/** 24 hours in ms — the auto-refresh cadence (client-side copy; the server is
 *  the source of truth, this is only for the instant optimistic countdown). */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Format milliseconds remaining as HH:MM:SS (clamped at 0). */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Format a date cell (Last Runtime / Last Edited) as MM-DD-YYYY, or "-" when
 *  empty/invalid. Tolerant of both a Date (initial server render) and an ISO
 *  string (after a sync/poll JSON response). */
function formatDateCell(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

/** Columns the per-website table can be sorted by (Purpose is not sortable). */
type SortKey = "name" | "status" | "lastEditedAt" | "lastRunAt";

/** The ↑/↓ indicator, shown only on the currently-active sort column. Green to
 *  stand out as the active-sort marker (matches the app's "Active" green). */
function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  return <span className="text-green-600">{dir === "asc" ? "↑" : "↓"}</span>;
}

export interface AutomationRow {
  id: string;
  name: string;
  externalUrl: string;
  status: string; // "active" | "paused"
  purpose?: string | null; // optional free-text note
  // When the automation last ran on its source platform. Sync-only (never set
  // manually). Date on initial server render, ISO string after a sync/poll.
  lastRunAt?: string | Date | null;
  // When the automation was last edited on its source platform. Sync/import-only
  // (never set via the dialog). Date on initial server render, ISO string after
  // a sync/poll. Populated for all synced platforms (n8n/GHL `updatedAt`, Make
  // `lastEdit`); "-" only until a row has been synced or has no value yet.
  lastEditedAt?: string | Date | null;
}

// ---------------------------------------------------------------------------
// CSV export (Approach A): the export keeps its OWN column list, independent of
// the table JSX. Adding/removing an export column = edit THIS array (one place).
// ⚠️ Keep this order IN SYNC with the on-screen table column order: whenever the
// table columns are rearranged, reorder these to match. (Table shows Name with
// its link underneath; the CSV splits Link into its own 2nd column.) Dates use
// MM-DD-YYYY (formatDateCell) and export EMPTY when blank, so a re-import never
// mistakes the display "-" for a value. Status exports the app's own values.
// ---------------------------------------------------------------------------
const EXPORT_COLUMNS: { header: string; value: (r: AutomationRow) => string }[] =
  [
    { header: "Name", value: (r) => r.name ?? "" },
    { header: "Link", value: (r) => r.externalUrl ?? "" },
    { header: "Status", value: (r) => r.status },
    { header: "Purpose", value: (r) => r.purpose ?? "" },
    {
      header: "Last Edited",
      value: (r) => (r.lastEditedAt ? formatDateCell(r.lastEditedAt) : ""),
    },
    {
      header: "Last Runtime",
      value: (r) => (r.lastRunAt ? formatDateCell(r.lastRunAt) : ""),
    },
  ];

/** Escape one CSV field: wrap in double-quotes (doubling internal quotes) when
 *  it contains a comma, quote, or newline. Purpose can contain all three. */
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize rows to a CSV string (CRLF line endings, RFC-4180 style). */
function rowsToCsv(rows: AutomationRow[]): string {
  const header = EXPORT_COLUMNS.map((c) => csvEscape(c.header)).join(",");
  const body = rows.map((r) =>
    EXPORT_COLUMNS.map((c) => csvEscape(c.value(r))).join(","),
  );
  return [header, ...body].join("\r\n");
}

export function AutomationsTableClient({
  platform,
  label,
  description,
  icon,
  iconColor,
  initialRows,
  canSync = false,
  hasApiKey = false,
  autoRefresh = { enabled: false, nextRefreshAt: null },
}: {
  platform: string;
  label: string;
  description: string;
  /** Path (under /public) to the website's brand logo. */
  icon: string;
  /** Brand colour to tint a monochrome SVG glyph via CSS mask; omit for
   *  full-colour image icons. Mirrors the Main Page card. */
  iconColor?: string;
  initialRows: AutomationRow[];
  /** When true, "Refresh List" performs a real sync; otherwise it shows the
   *  temporary placeholder error (platforms whose sync isn't built yet). */
  canSync?: boolean;
  /** Whether this platform has an API credential configured. Gates the
   *  auto-refresh toggle (can't turn on without an integration). */
  hasApiKey?: boolean;
  /** Server-provided auto-refresh state for this platform. */
  autoRefresh?: { enabled: boolean; nextRefreshAt: string | null };
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRow | null>(null);
  // The purpose text shown in the read-only "Show purpose" popup (null = closed).
  const [showingPurpose, setShowingPurpose] = useState<string | null>(null);
  // Column sorting (client-side, ONE column at a time, two-state toggle).
  // Defaults to Name ascending (matches the server's name-asc ordering). The
  // date columns always sink blanks ("-") to the bottom (see the sort below).
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // "Refresh List" state. On syncable platforms the button calls the real
  // sync; on the rest it shows a temporary placeholder error. `refreshError`
  // holds the red error text (real or placeholder); `refreshing` is the
  // in-flight spinner state for a real sync.
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Holds the auto-revert timer so we can clear it (on re-click or unmount).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-refresh mode state (Option A). `autoEnabled` + `nextRefreshAt` come
  // from the server; `remainingMs` is the live countdown; `autoError` is the
  // red text under the toggle (e.g. no API integration), fading after 5s.
  const [autoEnabled, setAutoEnabled] = useState(autoRefresh.enabled);
  const [nextRefreshAt, setNextRefreshAt] = useState<string | null>(
    autoRefresh.nextRefreshAt,
  );
  const [remainingMs, setRemainingMs] = useState(() =>
    autoRefresh.enabled && autoRefresh.nextRefreshAt
      ? new Date(autoRefresh.nextRefreshAt).getTime() - Date.now()
      : 0,
  );
  const [autoError, setAutoError] = useState<string | null>(null);
  const autoErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timers if the component unmounts.
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (autoErrorTimer.current) clearTimeout(autoErrorTimer.current);
    };
  }, []);

  // Live countdown to the next scheduled refresh (ticks every second).
  useEffect(() => {
    if (!autoEnabled || !nextRefreshAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () => setRemainingMs(new Date(nextRefreshAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autoEnabled, nextRefreshAt]);

  // Once the countdown elapses, the cron refreshes within its interval. Poll
  // for the new schedule + refreshed rows so an open tab stays in sync. Gated
  // on a boolean (not remainingMs) so it doesn't re-subscribe every tick.
  const countdownElapsed = autoEnabled && !!nextRefreshAt && remainingMs <= 0;
  useEffect(() => {
    if (!countdownElapsed) return;
    const id = setInterval(async () => {
      try {
        const [stateRes, rowsRes] = await Promise.all([
          fetch(`/api/automations/autorefresh?platform=${platform}`),
          fetch(`/api/automations?platform=${platform}`),
        ]);
        if (stateRes.ok) {
          const { state } = await stateRes.json();
          setAutoEnabled(!!state?.enabled);
          if (state?.nextRefreshAt) setNextRefreshAt(state.nextRefreshAt);
        }
        if (rowsRes.ok) {
          const { automations } = await rowsRes.json();
          if (Array.isArray(automations)) setRows(automations);
        }
      } catch {
        // transient; retry on the next tick
      }
    }, 30000);
    return () => clearInterval(id);
  }, [countdownElapsed, platform]);

  // Clicking a sortable header: flip the direction if it's already the active
  // column, otherwise make it the active column starting ascending. Only one
  // column sorts at a time, so picking a new one clears the previous sort.
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Search filters by NAME only (Column 1), deliberately not the link; the
  // result is then sorted by the active column. Both are client-side (rows are
  // already loaded), so it's instant and combines cleanly. rows is never
  // mutated (we sort a copy). JS sort is stable, so ties keep the prior order.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q))
      : rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const time = (v: string | Date | null | undefined): number | null => {
      if (!v) return null;
      const t = new Date(v).getTime();
      return isNaN(t) ? null : t;
    };
    return base.slice().sort((a, b) => {
      switch (sortKey) {
        case "name":
          return (
            dir *
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          );
        case "status": {
          // Grouping toggle: asc = Active group first, desc = Active last.
          const rank = (s: string) => (s === "active" ? 0 : 1);
          return dir * (rank(a.status) - rank(b.status));
        }
        case "lastEditedAt":
        case "lastRunAt": {
          // Date sort with blanks ("-") ALWAYS last, regardless of direction.
          const ta = time(a[sortKey]);
          const tb = time(b[sortKey]);
          if (ta === null && tb === null) return 0;
          if (ta === null) return 1;
          if (tb === null) return -1;
          return dir * (ta - tb);
        }
        default:
          return 0;
      }
    });
  }, [rows, query, sortKey, sortDir]);

  const handleCreated = (row: AutomationRow) =>
    setRows((prev) => [row, ...prev]);
  const handleSaved = (row: AutomationRow) =>
    setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));

  // Show a red error under the button for 5s, then auto-revert. Used for both
  // the placeholder (non-syncable platforms) and real sync failures.
  const showRefreshError = (message: string) => {
    setRefreshError(message);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshError(null), 5000);
  };

  const handleRefresh = async () => {
    // Platforms without a real sync keep the temporary placeholder error.
    if (!canSync) {
      showRefreshError("Couldn't refresh. Live syncing isn't set up yet.");
      return;
    }

    if (refreshing) return; // ignore double-clicks while a sync is in flight
    setRefreshError(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setRefreshing(true);
    try {
      const res = await fetch("/api/automations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Refresh failed.");

      if (Array.isArray(data.rows)) setRows(data.rows);
      const r = data.result;
      const summary =
        r && (r.created || r.updated)
          ? `Synced. ${r.created} added, ${r.updated} updated.`
          : "List is up to date.";
      toast.success(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed.";
      showRefreshError(message);
    } finally {
      setRefreshing(false);
    }
  };

  // Red error under the auto-refresh toggle, fading after 5s (the standing
  // default for transient error texts).
  const showAutoError = (message: string) => {
    setAutoError(message);
    if (autoErrorTimer.current) clearTimeout(autoErrorTimer.current);
    autoErrorTimer.current = setTimeout(() => setAutoError(null), 5000);
  };

  const handleAutoToggle = async (checked: boolean) => {
    // Turning ON requires an API integration; block it and show the error.
    if (checked && !hasApiKey) {
      showAutoError("Can't auto-refresh. This website has no API integration yet.");
      return; // leave the switch off (it's controlled by autoEnabled)
    }

    // Optimistic: flip the switch + countdown immediately so it feels instant;
    // the server call runs in the background and we reconcile / roll back after.
    const prevEnabled = autoEnabled;
    const prevNext = nextRefreshAt;
    setAutoError(null);
    setAutoEnabled(checked);
    setNextRefreshAt(checked ? new Date(Date.now() + DAY_MS).toISOString() : null);

    try {
      const res = await fetch("/api/automations/autorefresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, enabled: checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't update auto-refresh.");
      // Reconcile with the server's canonical state (exact nextRefreshAt).
      setAutoEnabled(!!data.state?.enabled);
      setNextRefreshAt(data.state?.nextRefreshAt ?? null);
    } catch (err) {
      // Roll back the optimistic change and surface the error.
      setAutoEnabled(prevEnabled);
      setNextRefreshAt(prevNext);
      const message =
        err instanceof Error ? err.message : "Couldn't update auto-refresh.";
      showAutoError(message);
    }
  };

  // Hard delete, permanently removes the row after a confirm.
  const handleDelete = async (row: AutomationRow) => {
    const label = row.name || "this automation";
    if (!confirm(`Delete ${label}? This can't be undone.`)) return;
    const res = await fetch(`/api/automations/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Deleted");
  };

  // Export CSV: builds the CSV from ALL rows (not the filtered/sorted view) and
  // triggers a client-side download. A leading BOM keeps Excel reading it as
  // UTF-8. Filename: <platform>-automations-MM-DD-YYYY.csv.
  const handleExportCsv = () => {
    const csv = rowsToCsv(rows);
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${platform}-automations-${formatDateCell(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header, title/description on the left; edit-mode toggle and (when
          on) the "+ New Workflow" button on the right. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {/* Brand logo, same treatment + size as the Main Page card: a
                monochrome SVG glyph tinted via CSS mask when iconColor is set,
                otherwise a plain full-colour image. */}
            {iconColor ? (
              <span
                aria-hidden
                className="h-8 w-8 shrink-0"
                style={{
                  backgroundColor: iconColor,
                  maskImage: `url(${icon})`,
                  WebkitMaskImage: `url(${icon})`,
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
                src={icon}
                alt=""
                className="h-8 w-8 shrink-0 object-contain"
              />
            )}
            <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh mode (Option A). Far left of the toolbar, styled
              like the Edit mode toggle but with a clock icon. When ON, a
              countdown to the next scheduled refresh shows under it; turning
              it on without an API integration is blocked with a red error. */}
          <div className="relative flex items-center gap-2 text-xs text-zinc-600">
            <Clock className="h-3.5 w-3.5" />
            Auto-refresh list
            <Switch checked={autoEnabled} onCheckedChange={handleAutoToggle} />
            {autoError ? (
              <p
                role="alert"
                className="absolute left-0 top-full z-10 mt-1 max-w-xs text-xs font-medium text-red-600"
              >
                {autoError}
              </p>
            ) : autoEnabled && nextRefreshAt ? (
              <p className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap text-[11px] font-medium text-zinc-500">
                {remainingMs > 0
                  ? `Next refresh in ${formatCountdown(remainingMs)}`
                  : "Refreshing soon…"}
              </p>
            ) : null}
          </div>

          {/* Refresh List. Sits to the LEFT of the Edit mode toggle, same
              style as "+ New Workflow". On syncable platforms it runs a real
              sync (spinner while in flight, success toast); on the rest it
              shows the temporary placeholder error. Either way, a failure
              turns the button red with the error message below it for 5s. */}
          <div className="relative">
            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                refreshError &&
                  "bg-red-600 text-white hover:bg-red-600 focus-visible:ring-red-600/50",
              )}
            >
              <RefreshCw
                className={cn("mr-2 h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              {refreshing ? "Refreshing…" : "Refresh List"}
            </Button>
            {refreshError && (
              <p
                role="alert"
                className="absolute right-0 top-full z-10 mt-1 max-w-xs text-right text-xs font-medium text-red-600"
              >
                {refreshError}
              </p>
            )}
          </div>

          {/* Export CSV. A list action (mirror of the import), so it sits with
              Refresh List. White (outline) button. Exports ALL rows (not the
              filtered/sorted view); disabled when the table is empty. */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={rows.length === 0}
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            Export CSV
          </Button>

          {/* Vertical divider between the list actions (auto-refresh + Refresh
              List) and the editing controls (Edit mode + New Workflow). */}
          <Separator orientation="vertical" className="h-5 self-center" />

          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
          {editMode && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Workflow
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Search bar, searches the automation NAME only. */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search automations by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Table. Headers always render; empty / no-match message sits inside
            the table body as a full-width row. The link lives under the name
            in the Name cell (no separate Link column). Rows are clickable only
            in edit mode (click → edit). */}
        {/* Option B sticky header: the table gets its OWN bounded scroll area
            (max-h + overflow-auto), so only the list scrolls while the toolbar
            and page stay put. Each header cell is `sticky top-0` with an opaque
            bg (so rows don't show through) and an inset bottom-edge shadow that
            stands in for the row border, which would otherwise scroll away.

            Horizontal scroll + frozen Name column: the table carries a
            `min-w-[1100px]` so once columns exceed the card width it overflows
            and the existing overflow-auto shows a horizontal scrollbar (drag,
            Shift+wheel, or trackpad swipe). The first column (Name + its link)
            is `sticky left-0` on both the header and every body row so the
            workflow's identity stays in view while scrolling sideways. The
            top-left "Name" header is the corner: sticky on BOTH axes with the
            highest z-index (z-20) so it sits above the header row and the
            frozen column during a diagonal scroll. Layering: corner z-20 >
            header row / frozen column z-10 > body. */}
        <Card>
          <CardContent className="max-h-[70vh] overflow-auto p-0">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  {/* Corner cell: pinned to BOTH the top (header) and the left
                      (frozen Name column), so it needs the highest z-index plus
                      both the bottom-edge shadow (header) and the right-edge
                      shadow (frozen column). */}
                  <th
                    onClick={() => toggleSort("name")}
                    aria-sort={
                      sortKey === "name"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="sticky left-0 top-0 z-20 w-[600px] min-w-[600px] max-w-[600px] cursor-pointer select-none bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7,inset_-1px_0_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center gap-1">
                      Name
                      <SortArrow active={sortKey === "name"} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("status")}
                    aria-sort={
                      sortKey === "status"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center gap-1">
                      Status
                      <SortArrow active={sortKey === "status"} dir={sortDir} />
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 whitespace-nowrap bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7]">
                    Purpose
                  </th>
                  <th
                    onClick={() => toggleSort("lastEditedAt")}
                    aria-sort={
                      sortKey === "lastEditedAt"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Last Edited
                      <SortArrow
                        active={sortKey === "lastEditedAt"}
                        dir={sortDir}
                      />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("lastRunAt")}
                    aria-sort={
                      sortKey === "lastRunAt"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Last Runtime
                      <SortArrow active={sortKey === "lastRunAt"} dir={sortDir} />
                    </span>
                  </th>
                  {editMode && (
                    <th className="sticky top-0 z-10 w-16 bg-zinc-50 px-3 py-2 shadow-[inset_0_-1px_0_0_#e4e4e7]"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={editMode ? 6 : 5}
                      className="px-3 py-16 text-center text-sm text-zinc-500"
                    >
                      {rows.length === 0
                        ? "No automations yet."
                        : "No automations match your search."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={editMode ? () => setEditing(r) : undefined}
                      className={cn(
                        "group border-t hover:bg-zinc-50",
                        editMode && "cursor-pointer",
                      )}
                    >
                      <td className="sticky left-0 z-10 w-[600px] min-w-[600px] max-w-[600px] bg-white px-3 py-2 align-top shadow-[inset_-1px_0_0_0_#e4e4e7] group-hover:bg-zinc-50">
                        {/* Frozen Name column (sticky left-0): stays in view
                            during horizontal scroll so the row's identity is
                            always visible. Needs its own opaque bg (rows are
                            otherwise transparent over the card) + a matching
                            group-hover so it doesn't look detached from the
                            hovered row, and a right-edge shadow to separate it
                            from the scrolling columns. Name on top; the link
                            sits beneath it (subdued), replacing the old separate
                            Link column. The full URL is kept (Make's hostname
                            alone is meaningless) and wraps within the fixed
                            600px via break-all. */}
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
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {r.externalUrl}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            r.status === "active"
                              ? "text-green-600"
                              : "text-zinc-900",
                          )}
                        >
                          {r.status === "active" ? "Active" : "Paused"}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {/* Purpose: "Show" opens a read-only popup when there's
                            text; "None" (red, non-clickable) when empty. In edit
                            mode the button is disabled and clicking the row opens
                            the Edit Workflow dialog (where the purpose is set). */}
                        {r.purpose ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={editMode}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowingPurpose(r.purpose ?? "");
                            }}
                          >
                            Show
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-disabled="true"
                            onClick={(e) => e.preventDefault()}
                            className="cursor-default border-red-300 bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600"
                          >
                            None
                          </Button>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-center">
                        {/* Last Edited: sync/import-filled date (MM-DD-YYYY). A
                            plain "-" when empty (sync-only, never manual). */}
                        {r.lastEditedAt ? (
                          <span className="text-xs tabular-nums text-zinc-700">
                            {formatDateCell(r.lastEditedAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-center">
                        {/* Last Runtime: sync-filled date (MM-DD-YYYY). A plain
                            "-" when empty (the column never accepts manual
                            entry). */}
                        {r.lastRunAt ? (
                          <span className="text-xs tabular-nums text-zinc-700">
                            {formatDateCell(r.lastRunAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
                      </td>
                      {editMode && (
                        <td className="px-3 py-2 align-top text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(r);
                            }}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Delete
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
      </div>

      {/* Add */}
      <WorkflowDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        platform={platform}
        onCreated={handleCreated}
      />
      {/* Edit */}
      <WorkflowDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        platform={platform}
        existing={editing ?? undefined}
        onSaved={handleSaved}
      />

      {/* Read-only "Show purpose" popup */}
      <Dialog
        open={showingPurpose !== null}
        onOpenChange={(o) => !o && setShowingPurpose(null)}
      >
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Purpose</DialogTitle>
          </DialogHeader>
          {/* Grows with content up to 85vh, then the text scrolls (single
              scrollbar) while the title stays pinned. */}
          <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm text-zinc-700">
            {showingPurpose}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
