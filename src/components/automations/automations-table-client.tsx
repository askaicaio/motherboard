"use client";

// Per Website Page — header (title + edit-mode toggle + "+ New Workflow"),
// search, and the automations table. Two columns: Name and Link (the link is
// the automation's identity). The search bar filters by NAME only.
//
// Edit mode (the toggle, top-right): when ON it reveals the "+ New Workflow"
// button and makes table rows clickable (click a row to edit it). When OFF
// the table is read-only. Add/Edit happen in the WorkflowDialog.

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Workflow, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkflowDialog } from "./workflow-dialog";

export interface AutomationRow {
  id: string;
  name: string;
  externalUrl: string;
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
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
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
