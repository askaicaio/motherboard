"use client";

// Per Website Page, header (auto-refresh toggle + "Refresh List" + edit-mode
// toggle + "+ New Workflow"), search, and the automations table. The Name cell
// shows the name with the automation's link beneath it (the link is still its
// identity; it's just no longer a separate column). Search filters by NAME or LINK.
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
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
type SortKey = "name" | "status" | "lastEditedAt" | "lastRunAt" | "lastErrorAt";

/** Sort indicator next to every sortable column header, always in the SAME
 *  fixed-width (w-3) slot so the header label never shifts when sorting changes:
 *   - ACTIVE column: a single dark-amber ▲ (asc) / ▼ (desc) glyph (unchanged).
 *   - INACTIVE but sortable: two stacked black triangles (up + down), a static
 *     hint that the column CAN be sorted (replaces the old blank slot).
 *  Both render at 12px (w-3) wide, so switching the active column never moves the
 *  header text left or right. */
function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (active) {
    return (
      <span className="inline-block w-3 text-center text-[10px] text-amber-600">
        {dir === "asc" ? "▲" : "▼"}
      </span>
    );
  }
  // Inactive-but-sortable hint: two black triangles (up + down) in the same w-3
  // box. An inline SVG (not stacked glyphs) so the two triangles sit tight and
  // pixel-aligned. viewBox is square + h-3/w-3 = 12px, which stays under the
  // header label's line box, so it doesn't grow the header row height either.
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="inline-block h-3 w-3 fill-zinc-900"
    >
      <path d="M6 1 L9 5 H3 Z" />
      <path d="M6 11 L3 7 H9 Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Which table columns are AUTO-MANAGED per platform (auto-populated, so a manual
// edit may be overwritten). Drives the ↻ "synced" marker in the column headers.
// TWO mechanisms feed this: the list sync (Refresh List + auto-refresh — writes
// Name/Status/Last Edited/Last Runtime) and error capture (writes Last Error).
// Kept in step with reality (make-sync / n8n-sync / ghl-automations-sync + which
// platforms have error tracking live):
//   - Make / n8n:     Name, Status, Last Edited, Last Runtime, AND Last Error —
//                     error tracking is live for both (rows in automation_errors).
//   - GHL / GHL b2b:  Name, Status, Last Edited — NOT Last Runtime (GHL exposes
//                     no run history) and NOT Last Error (error tracking is
//                     impossible via their API), so both stay "-".
//   - Zapier:         no live sync (CSV import only) → nothing is marked.
// The "name" key also covers the Link shown beneath the name (the sync writes the
// URL too). Purpose is never synced on any platform, so it never appears here.
// ⚠️ When a NEW column is added, decide if a sync/capture writes it and update
// this map (fold into the add-a-column touch-list).
// ---------------------------------------------------------------------------
const SYNCED_COLUMNS: Record<string, ReadonlySet<SortKey>> = {
  make: new Set<SortKey>([
    "name",
    "status",
    "lastEditedAt",
    "lastRunAt",
    "lastErrorAt",
  ]),
  n8n: new Set<SortKey>([
    "name",
    "status",
    "lastEditedAt",
    "lastRunAt",
    "lastErrorAt",
  ]),
  ghl: new Set<SortKey>(["name", "status", "lastEditedAt"]),
  "ghl-b2b": new Set<SortKey>(["name", "status", "lastEditedAt"]),
  // zapier omitted on purpose: CSV import only, no synced columns.
};

/** Fallback for platforms not in the map (e.g. Zapier): nothing is synced. */
const NO_SYNCED_COLUMNS: ReadonlySet<SortKey> = new Set<SortKey>();

/** The ↻ marker rendered to the LEFT of a synced column's header title. Signals
 *  that the column is auto-populated by Refresh List / auto-refresh, so manual
 *  edits to it may be overwritten on the next sync. The hover tooltip opens on
 *  the ICON ONLY (not the whole header cell). A click on the icon is NOT
 *  swallowed: it bubbles up to the header <th> so clicking the icon still
 *  toggles the column's sort like the rest of the header (the icon sits inside
 *  the sortable header, so blocking it would create a dead zone). When `spinning`
 *  is true (a manual Refresh List sync is in flight) the icon spins, mirroring
 *  the Refresh List button's own spinner so the two read as the same action. */
function SyncedColumnMarker({
  platformLabel,
  spinning = false,
  tooltip = "Updated by Refresh List. Manual edits may be overwritten.",
}: {
  platformLabel: string;
  spinning?: boolean;
  /** Hover text. Defaults to the list-sync wording; the Last Error column passes
   *  its own since that column is fed by error capture, not Refresh List. */
  tooltip?: string;
}) {
  return (
    // disableHoverablePopup: close as soon as the cursor leaves the trigger,
    // even if the popup is under the cursor. Standing default for Automations
    // tooltips (see the Purpose "Show" tooltip).
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        type="button"
        aria-label={`Synced from ${platformLabel}`}
        className="inline-flex cursor-pointer items-center text-zinc-400 hover:text-zinc-600"
      >
        <RefreshCw className={cn("h-3 w-3", spinning && "animate-spin")} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs normal-case">{tooltip}</TooltipContent>
    </Tooltip>
  );
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
  // Latest error date found by an integration for this automation. PLACEHOLDER:
  // error tracking doesn't exist yet, so nothing feeds this and every row shows
  // "-". Wire it to a real per-automation "last error at" once error tracking
  // lands. Rendered in RED (unlike the other date columns).
  lastErrorAt?: string | Date | null;
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
    {
      header: "Last Error",
      value: (r) => (r.lastErrorAt ? formatDateCell(r.lastErrorAt) : ""),
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
  // Latest `handleRefresh`, so the countdown-elapsed effect (declared above it)
  // can trigger a real sync without depending on its identity.
  const handleRefreshRef = useRef<
    ((opts?: { silent?: boolean }) => void) | null
  >(null);
  // Latest nextRefreshAt, read by the countdown-elapsed effect to re-verify the
  // countdown REALLY reached zero before firing (guards against a stale
  // remainingMs during rapid toggling — see that effect).
  const nextRefreshAtRef = useRef(nextRefreshAt);
  // Monotonic id per toggle click, so an out-of-order / stale server response
  // can't clobber the state set by a newer toggle.
  const autoReqSeq = useRef(0);

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

  // Keep the latest nextRefreshAt in a ref for the elapsed effect's re-verify
  // guard. Declared BEFORE that effect so it updates first in the same commit.
  useEffect(() => {
    nextRefreshAtRef.current = nextRefreshAt;
  }, [nextRefreshAt]);

  // Once the countdown elapses, the cron refreshes within its interval. Poll
  // for the new schedule + refreshed rows so an open tab stays in sync. Gated
  // on a boolean (not remainingMs) so it doesn't re-subscribe every tick.
  const countdownElapsed = autoEnabled && !!nextRefreshAt && remainingMs <= 0;
  useEffect(() => {
    if (!countdownElapsed) return;
    // Re-verify against the ACTUAL target time before firing. Rapid on/off
    // toggling can leave countdownElapsed briefly true off a STALE remainingMs
    // (a 0 left from a prior OFF) even though nextRefreshAt is ~24h out; only
    // fire once the countdown has genuinely reached zero.
    const target = nextRefreshAtRef.current;
    if (target && new Date(target).getTime() - Date.now() > 0) return;
    // Run the sync ourselves so the timed refresh is VISIBLE — this spins the
    // ↻ synced-column icons + the Refresh List button, same as a manual click,
    // just silently (no toast). The cron also runs it server-side; both are
    // idempotent upserts, and handleRefresh's own in-flight guard prevents
    // overlap with a manual refresh. Fires once when the countdown elapses.
    handleRefreshRef.current?.({ silent: true });
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

  // Search filters by NAME or LINK (the automation's URL) — case-insensitive
  // substring on either. The result is then sorted by the active column. Both
  // are client-side (rows are already loaded), so it's instant and combines
  // cleanly. rows is never mutated (we sort a copy). JS sort is stable, so ties
  // keep the prior order. (The link host is the same across rows per platform,
  // so in practice the link match discriminates on the scenario/workflow ID.)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.externalUrl ?? "").toLowerCase().includes(q),
        )
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
        case "lastRunAt":
        case "lastErrorAt": {
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

  // `silent` (used by the scheduled auto-refresh) does the same sync + spinner
  // but suppresses the success toast and the error text — it's an automatic
  // background refresh, not a user click.
  const handleRefresh = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    // Platforms without a real sync keep the temporary placeholder error.
    if (!canSync) {
      if (!silent) showRefreshError("Couldn't refresh. Live syncing isn't set up yet.");
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
      if (!silent) {
        const r = data.result;
        const summary =
          r && (r.created || r.updated)
            ? `Synced. ${r.created} added, ${r.updated} updated.`
            : "List is up to date.";
        toast.success(summary);
      }
    } catch (err) {
      if (!silent) {
        const message = err instanceof Error ? err.message : "Refresh failed.";
        showRefreshError(message);
      }
    } finally {
      setRefreshing(false);
      if (silent) {
        // Auto-refresh (timed): re-anchor the countdown so it loops immediately
        // instead of sticking on "Refreshing soon…" until the cron + poll reset
        // it. Same interval the server cron uses, so the two stay aligned.
        setNextRefreshAt(new Date(Date.now() + DAY_MS).toISOString());
      }
    }
  };
  // Keep the ref pointing at the latest handleRefresh for the elapsed effect
  // (updated in an effect, not during render).
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  // Red error under the auto-refresh toggle, fading after 5s (the standing
  // default for transient error texts).
  const showAutoError = (message: string) => {
    setAutoError(message);
    if (autoErrorTimer.current) clearTimeout(autoErrorTimer.current);
    autoErrorTimer.current = setTimeout(() => setAutoError(null), 5000);
  };

  const handleAutoToggle = async (checked: boolean) => {
    // Turning ON requires an API integration; block instantly if there's no key.
    if (checked && !hasApiKey) {
      showAutoError("Can't auto-refresh. This website has no API integration yet.");
      return; // leave the switch off (it's controlled by autoEnabled)
    }

    // Optimistic: flip the switch + countdown IMMEDIATELY so it responds to the
    // click with no delay (matches the health toggle). The server call runs in
    // the background — on enable it live-verifies the integration; we reconcile
    // on success, or roll back + show a red error on failure (e.g. a
    // present-but-faulty key, so a brief on-then-off is expected in that case).
    const prevEnabled = autoEnabled;
    const prevNext = nextRefreshAt;
    const seq = ++autoReqSeq.current;
    setAutoError(null);
    setAutoEnabled(checked);
    setNextRefreshAt(checked ? new Date(Date.now() + DAY_MS).toISOString() : null);
    // Seed the countdown to the full interval in the SAME update so
    // `countdownElapsed` isn't briefly true from a stale remainingMs (which would
    // fire a refresh the instant it turns on).
    setRemainingMs(checked ? DAY_MS : 0);

    try {
      const res = await fetch("/api/automations/autorefresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, enabled: checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't update auto-refresh.");
      // Ignore this response if a newer toggle has since fired (rapid on/off):
      // its optimistic state is the truth, and applying a stale response here
      // could re-enable + re-anchor after the user settled on OFF.
      if (seq !== autoReqSeq.current) return;
      // Reconcile with the server's canonical state (exact nextRefreshAt).
      setAutoEnabled(!!data.state?.enabled);
      setNextRefreshAt(data.state?.nextRefreshAt ?? null);
    } catch (err) {
      // A newer toggle superseded this one; leave the latest state as-is.
      if (seq !== autoReqSeq.current) return;
      // Roll back the optimistic change and surface the error.
      setAutoEnabled(prevEnabled);
      setNextRefreshAt(prevNext);
      showAutoError(
        err instanceof Error ? err.message : "Couldn't update auto-refresh.",
      );
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

  // Which columns this platform's sync manages (drives the header ↻ marker).
  const syncedColumns = SYNCED_COLUMNS[platform] ?? NO_SYNCED_COLUMNS;
  const isSynced = (key: SortKey) => syncedColumns.has(key);

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
            Auto-refresh
            {/* ON = green, OFF = red (user 2026-07-01) — green matches the app's
                other greens (Active status, "API Key Integrated"), red flags that
                auto-refresh is not running. Scoped to THIS toggle only via
                className; the shared Switch base is unchanged (Edit mode etc.
                stay black/gray). */}
            <Switch
              checked={autoEnabled}
              onCheckedChange={handleAutoToggle}
              className="data-checked:bg-green-600 data-unchecked:bg-red-600"
            />
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
              onClick={() => handleRefresh()}
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

          {/* Edit mode toggle. The "+ New Workflow" button it reveals pops in
              BELOW the toggle (absolutely positioned via `top-full`), so turning
              edit mode on/off never reflows the toolbar or shifts any other
              element (same trick as the auto-refresh countdown + Refresh List
              error above). The slot below is simply empty when edit mode is off. */}
          <div className="relative flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
            {editMode && (
              <div className="absolute right-0 top-full z-10 mt-2">
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  New Workflow
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Search bar, searches the automation NAME or LINK. */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search automations by name or link…"
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
            `min-w-[1250px]` so once columns exceed the card width it overflows
            and the existing overflow-auto shows a horizontal scrollbar (drag,
            Shift+wheel, or trackpad swipe). The first column (Name + its link)
            is `sticky left-0` on both the header and every body row so the
            workflow's identity stays in view while scrolling sideways. The
            top-left "Name" header is the corner: sticky on BOTH axes with the
            highest z-index (z-20) so it sits above the header row and the
            frozen column during a diagonal scroll. Layering: corner z-20 >
            header row / frozen column z-10 > body. */}
        <TooltipProvider delay={300}>
        <Card>
          <CardContent className="max-h-[70vh] overflow-auto p-0">
            <table className="w-full min-w-[1250px] text-sm">
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
                    className="sticky left-0 top-0 z-20 w-[400px] min-w-[400px] max-w-[400px] cursor-pointer select-none bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7,inset_-1px_0_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center gap-1">
                      {isSynced("name") && (
                        <SyncedColumnMarker platformLabel={label} spinning={refreshing} />
                      )}
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
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {isSynced("status") && (
                        <SyncedColumnMarker platformLabel={label} spinning={refreshing} />
                      )}
                      Status
                      <SortArrow active={sortKey === "status"} dir={sortDir} />
                    </span>
                  </th>
                  <th className="sticky top-0 z-10 w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
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
                      {isSynced("lastEditedAt") && (
                        <SyncedColumnMarker platformLabel={label} spinning={refreshing} />
                      )}
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
                      {isSynced("lastRunAt") && (
                        <SyncedColumnMarker platformLabel={label} spinning={refreshing} />
                      )}
                      Last Runtime
                      <SortArrow active={sortKey === "lastRunAt"} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("lastErrorAt")}
                    aria-sort={
                      sortKey === "lastErrorAt"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {isSynced("lastErrorAt") && (
                        // Behaves exactly like the other synced-column markers
                        // (spins with a Refresh List sync); only its tooltip is
                        // tailored, since Last Error is fed by error capture
                        // (Check for New Errors + cron) rather than Refresh List.
                        <SyncedColumnMarker
                          platformLabel={label}
                          spinning={refreshing}
                          tooltip="Updated by error tracking."
                        />
                      )}
                      Last Error
                      <SortArrow active={sortKey === "lastErrorAt"} dir={sortDir} />
                    </span>
                  </th>
                  {/* Actions (delete) column. ALWAYS rendered, even when edit
                      mode is off, so toggling only shows/hides the trash icon
                      INSIDE the cell instead of adding/removing a whole column
                      (which would resize + shift every other column). Fixed
                      width reserves the space; the header stays empty. */}
                  <th className="sticky top-0 z-10 w-16 bg-zinc-50 px-3 py-2 shadow-[inset_0_-1px_0_0_#e4e4e7]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
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
                      <td className="sticky left-0 z-10 w-[400px] min-w-[400px] max-w-[400px] bg-white px-3 py-2 align-top shadow-[inset_-1px_0_0_0_#e4e4e7] group-hover:bg-zinc-50">
                        {/* Frozen Name column (sticky left-0): stays in view
                            during horizontal scroll so the row's identity is
                            always visible. Needs its own opaque bg (rows are
                            otherwise transparent over the card) + a matching
                            group-hover so it doesn't look detached from the
                            hovered row, and a right-edge shadow to separate it
                            from the scrolling columns. Name on top; the link
                            sits beneath it (subdued), replacing the old separate
                            Link column. The full URL is stored/clickable, but
                            DISPLAYS on a single line truncated with an ellipsis;
                            the `min-w-0` lets the text shrink inside the flex row
                            so the ellipsis kicks in within the fixed 400px. The
                            ellipsis is on the LEFT (`[direction:rtl] text-left`)
                            so the END of the link (the workflow/scenario ID, the
                            useful part) stays visible, e.g. "…/builder/<id>". */}
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
                      <td className="px-3 py-2 text-center align-top">
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
                      <td className="w-[120px] min-w-[120px] max-w-[120px] px-3 py-2 text-left align-top">
                        {/* Purpose: a preview of the purpose text that fills the
                            FIXED-WIDTH column (locked to 120px on the th + td, same
                            trick the frozen Name column uses) and clamps to 2 lines
                            (`line-clamp-2`) before the ellipsis. Clicking it opens
                            the read-only popup with the full text; hovering shows a
                            tooltip with the same full text (the popup/tooltip are how
                            the rest is read). "None" (red) when empty. In edit mode
                            the blurb is disabled (pointer-events-none) so a row click
                            falls through to open the Edit Workflow dialog (where the
                            purpose is set).
                            ⚠️ DO NOT add `block` (or any display utility) to the
                            button: Tailwind v4 emits `.block{display:block}` AFTER
                            `.line-clamp-2{display:-webkit-box}` in the stylesheet, so
                            `block` overrides the -webkit-box that line-clamp needs and
                            the clamp silently stops working (text wraps unbounded).
                            The 120px column width is the width knob (change on th+td);
                            line-clamp-2 is the line-count knob. */}
                        {r.purpose ? (
                          // disableHoverablePopup: the tooltip closes as soon as
                          // the cursor leaves the blurb, even if the popup itself is
                          // under the cursor (default keeps it open while hovering
                          // the popup, which the user found sticky).
                          <Tooltip disableHoverablePopup>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  disabled={editMode}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowingPurpose(r.purpose ?? "");
                                  }}
                                  className="w-full cursor-pointer line-clamp-2 break-words text-left text-xs text-zinc-700 hover:text-zinc-900 hover:underline disabled:pointer-events-none disabled:cursor-default disabled:no-underline"
                                >
                                  {r.purpose}
                                </button>
                              }
                            />
                            <TooltipContent className="max-w-xs whitespace-pre-wrap break-words text-left normal-case">
                              {r.purpose}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
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
                      <td className="px-3 py-2 align-top text-center">
                        {/* Last Error: latest error date (MM-DD-YYYY), rendered
                            in RED. PLACEHOLDER: nothing feeds this yet (no error
                            tracking), so it's always "-" for now. */}
                        {r.lastErrorAt ? (
                          <span className="text-xs tabular-nums text-red-600">
                            {formatDateCell(r.lastErrorAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
                      </td>
                      {/* Actions cell: always present (reserves the column
                          width); the trash button only renders in edit mode, so
                          toggling never resizes the table. Trash-icon delete,
                          matching the Error History table: subtle gray, red on
                          hover. */}
                      <td className="px-3 py-2 align-top text-center">
                        {editMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(r);
                            }}
                            aria-label="Delete this automation"
                            className="inline-flex items-center rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
        </TooltipProvider>
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
