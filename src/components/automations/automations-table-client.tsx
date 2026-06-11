"use client";

// Per Website Page, header (title + edit-mode toggle + "+ New Workflow"),
// search, and the automations table. Two columns: Name and Link (the link is
// the automation's identity). The search bar filters by NAME only.
//
// Edit mode (the toggle, top-right): when ON it reveals the "+ New Workflow"
// button and makes table rows clickable (click a row to edit it). When OFF
// the table is read-only. Add/Edit happen in the WorkflowDialog.

import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Workflow, Plus, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WorkflowDialog } from "./workflow-dialog";

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
}: {
  platform: string;
  label: string;
  description: string;
  initialRows: AutomationRow[];
  /** When true, "Refresh List" performs a real sync; otherwise it shows the
   *  temporary placeholder error (platforms whose sync isn't built yet). */
  canSync?: boolean;
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

  // Clear any pending revert timer if the component unmounts.
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

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
