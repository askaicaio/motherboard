"use client";

// Per Website Page, header (auto-refresh toggle + "Refresh List" + edit-mode
// toggle + "+ New Workflow"), search, and the automations table. Two columns:
// Name and Link (the link is the automation's identity). Search filters by
// NAME only.
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
import { Search, ExternalLink, Workflow, Plus, Pencil, RefreshCw, Clock } from "lucide-react";
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

export interface AutomationRow {
  id: string;
  name: string;
  externalUrl: string;
  status: string; // "active" | "paused"
}

export function AutomationsTableClient({
  platform,
  label,
  description,
  initialRows,
  canSync = false,
  hasApiKey = false,
  autoRefresh = { enabled: false, nextRefreshAt: null },
}: {
  platform: string;
  label: string;
  description: string;
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

  // Search filters by NAME only (Column 1), deliberately not the link.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

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

  return (
    <div className="space-y-6">
      {/* Header, title/description on the left; edit-mode toggle and (when
          on) the "+ New Workflow" button on the right. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-zinc-500" />
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
                // TRIAL (Make page only): give the black button a hover. If the
                // user likes it, the real fix is to drop the `[a]:` restriction
                // in ui/button.tsx so ALL default buttons get this globally.
                platform === "make" && "hover:bg-primary/80",
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

          {/* Vertical divider between the list actions (auto-refresh + Refresh
              List) and the editing controls (Edit mode + New Workflow). */}
          <Separator orientation="vertical" className="h-5 self-center" />

          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
          {editMode && (
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              // TRIAL (Make page only): same black-button hover as Refresh List.
              className={cn(platform === "make" && "hover:bg-primary/80")}
            >
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

        {/* Table, Name/Link headers always render; empty / no-match message
            sits inside the table body as a full-width row. Rows are clickable
            only in edit mode (click → edit). */}
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Link</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  {editMode && <th className="w-16 px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={editMode ? 4 : 3}
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
                        "border-t hover:bg-zinc-50",
                        editMode && "cursor-pointer",
                      )}
                    >
                      <td className="px-3 py-2 align-top font-medium text-zinc-900">
                        {r.name || (
                          <span className="font-normal text-zinc-400">
                            (unnamed)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <a
                          href={r.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 break-all text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {r.externalUrl}
                        </a>
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
    </div>
  );
}
