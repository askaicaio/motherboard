"use client";

// Per Website Page — header (title + edit-mode toggle + "+ New Workflow"),
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
}: {
  platform: string;
  label: string;
  description: string;
  initialRows: AutomationRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRow | null>(null);
  // TEMPORARY placeholder state for the "Refresh List" button. Live syncing
  // isn't built yet, so pressing the button always shows this error. When real
  // refresh/sync is implemented, remove this forced error and wire the button
  // to the actual refresh call. (See the Automations to-do list.)
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // Holds the auto-revert timer so we can clear it (on re-click or unmount).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending revert timer if the component unmounts.
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  // Search filters by NAME only (Column 1) — deliberately not the link.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  const handleCreated = (row: AutomationRow) =>
    setRows((prev) => [row, ...prev]);
  const handleSaved = (row: AutomationRow) =>
    setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));

  // TEMPORARY: the Refresh List button can't sync anything yet, so it just
  // shows an error, then auto-reverts to its normal form after 5 seconds.
  // Replace with the real refresh once syncing exists.
  const handleRefresh = () => {
    setRefreshError("Couldn't refresh — live syncing isn't set up yet.");
    // Restart the countdown on each click so the error always shows for a
    // full 5s, then the button returns to its regular (non-error) form.
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshError(null), 5000);
  };

  // Hard delete — permanently removes the row after a confirm.
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
      {/* Header — title/description on the left; edit-mode toggle and (when
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
          {/* Refresh List — TEMPORARY placeholder. Sits to the LEFT of the Edit
              mode toggle. Same style as "+ New Workflow" (default Button), but
              turns red with an error message below it on click, because live
              syncing isn't built yet. Remove the error behaviour when it works. */}
          <div className="relative">
            <Button
              size="sm"
              onClick={handleRefresh}
              className={cn(
                refreshError &&
                  "bg-red-600 text-white hover:bg-red-600 focus-visible:ring-red-600/50",
              )}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Refresh List
            </Button>
            {refreshError && (
              <p
                role="alert"
                className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap text-xs font-medium text-red-600"
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
        {/* Search bar — searches the automation NAME only. */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search automations by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Table — Name/Link headers always render; empty / no-match message
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
