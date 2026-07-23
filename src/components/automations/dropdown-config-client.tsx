"use client";

// Client for the Automations "Dropdown Configuration" page. Renders one table
// per dropdown-driven column (Author, Automation Tags, GHL Tags, Trigger Event)
// plus a Webhook Links table, each with its own search bar, laid out two-up.
// A page-level Edit mode toggle reveals per-table "Add Option", row-click
// editing, and per-row delete.
//
// GHL Tags is a richer 3-column table: Tag | Status (fixed dropdown, default
// Unknown) | Notes (free text, presented + edited like the Per Website Purpose
// column). The other four tables are simple single-column lists.
//
// The four generic columns write to /api/automations/dropdown-choices; Webhook
// Links writes to /api/automations/webhook-choices. Editing is off by default.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DROPDOWN_COLUMNS,
  GHL_TAG_STATUSES,
  type DropdownChoiceRow,
  type DropdownColumnKey,
  type WebhookChoiceRow,
} from "@/lib/automations/dropdown-config";
import { ChoiceDialog } from "./choice-dialog";

/** A unified row shown in any of the tables. */
interface Item {
  id: string;
  value: string;
  status?: string | null;
  notes?: string | null;
}

/** Describes one table on the page. */
interface TableDescriptor {
  id: string;
  title: string;
  fieldLabel: string;
  placeholder: string;
  isUrl: boolean;
  ghlOnly?: boolean;
  hasStatus?: boolean;
  hasNotes?: boolean;
}

const WEBHOOK_TABLE: TableDescriptor = {
  id: "webhooks",
  title: "Webhook Links",
  fieldLabel: "Webhook URL",
  placeholder: "https://…",
  isUrl: true,
};

const TABLES: TableDescriptor[] = [
  ...DROPDOWN_COLUMNS.map((c) => ({
    id: c.key,
    title: c.title,
    fieldLabel: c.fieldLabel,
    placeholder: c.placeholder,
    isUrl: false,
    ghlOnly: c.ghlOnly,
    hasStatus: c.hasStatus,
    hasNotes: c.hasNotes,
  })),
  WEBHOOK_TABLE,
];

const STATUS_TONE: Record<string, string> = {
  Keep: "bg-emerald-100 text-emerald-700",
  "To Remove": "bg-amber-100 text-amber-700",
  Removed: "bg-zinc-200 text-zinc-600",
  Unknown: "bg-zinc-100 text-zinc-500",
};

// Sort rank for the GHL Tags status grouping. GHL_TAG_STATUSES already lists
// the desired top-to-bottom group order (Keep, To Remove, Unknown, Removed);
// anything unrecognized sorts last.
function statusRank(status?: string | null): number {
  const i = (GHL_TAG_STATUSES as readonly string[]).indexOf(status ?? "");
  return i === -1 ? GHL_TAG_STATUSES.length : i;
}

export function DropdownConfigClient({
  initialChoices,
  initialWebhooks,
}: {
  initialChoices: DropdownChoiceRow[];
  initialWebhooks: WebhookChoiceRow[];
}) {
  const router = useRouter();
  const [choices, setChoices] = useState(initialChoices);
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [editMode, setEditMode] = useState(false);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<{
    tableId: string;
    existing: Item | null;
  } | null>(null);
  // The notes text shown in the read-only Notes popup (null = closed).
  const [showingNotes, setShowingNotes] = useState<string | null>(null);

  const itemsByTable = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const t of TABLES) m[t.id] = [];
    for (const c of choices) {
      (m[c.columnKey] ??= []).push({
        id: c.id,
        value: c.value,
        status: c.status,
        notes: c.notes,
      });
    }
    m.webhooks = webhooks.map((w) => ({ id: w.id, value: w.url }));
    return m;
  }, [choices, webhooks]);

  const activeTable = dialog
    ? TABLES.find((t) => t.id === dialog.tableId) ?? null
    : null;

  async function submitDialog(payload: {
    value: string;
    status?: string;
    notes?: string;
  }): Promise<string | null> {
    if (!dialog || !activeTable) return "No table selected";
    const isEdit = !!dialog.existing;
    const isWebhook = activeTable.id === "webhooks";
    const isGhl = activeTable.id === "ghl_tags";

    const endpoint = isWebhook
      ? isEdit
        ? `/api/automations/webhook-choices/${dialog.existing!.id}`
        : "/api/automations/webhook-choices"
      : isEdit
        ? `/api/automations/dropdown-choices/${dialog.existing!.id}`
        : "/api/automations/dropdown-choices";
    const method = isEdit ? "PATCH" : "POST";
    const body = isWebhook
      ? { url: payload.value }
      : {
          ...(isEdit ? {} : { columnKey: activeTable.id }),
          value: payload.value,
          ...(isGhl ? { status: payload.status, notes: payload.notes ?? "" } : {}),
        };

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: {
      error?: string;
      choice?: { id: string; status?: string | null; notes?: string | null };
      webhook?: { id: string };
    } = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) return data.error || `Save failed (${res.status})`;

    if (isWebhook) {
      const saved = data.webhook;
      if (!saved) return "Save failed";
      setWebhooks((prev) =>
        isEdit
          ? prev.map((w) => (w.id === saved.id ? { id: saved.id, url: payload.value } : w))
          : [{ id: saved.id, url: payload.value }, ...prev],
      );
    } else {
      const saved = data.choice;
      if (!saved) return "Save failed";
      const columnKey = activeTable.id as DropdownColumnKey;
      setChoices((prev) =>
        isEdit
          ? prev.map((c) =>
              c.id === saved.id
                ? { ...c, value: payload.value, status: saved.status, notes: saved.notes }
                : c,
            )
          : [
              {
                id: saved.id,
                columnKey,
                value: payload.value,
                status: saved.status,
                notes: saved.notes,
              },
              ...prev,
            ],
      );
    }
    toast.success(isEdit ? "Saved" : "Added");
    router.refresh();
    return null;
  }

  async function handleDelete(table: TableDescriptor, item: Item) {
    const shown = table.isUrl ? item.value : `"${item.value}"`;
    if (!confirm(`Remove ${shown} from ${table.title}?`)) return;
    const isWebhook = table.id === "webhooks";
    const endpoint = isWebhook
      ? `/api/automations/webhook-choices/${item.id}`
      : `/api/automations/dropdown-choices/${item.id}`;
    const res = await fetch(endpoint, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to remove");
      return;
    }
    if (isWebhook) setWebhooks((prev) => prev.filter((w) => w.id !== item.id));
    else setChoices((prev) => prev.filter((c) => c.id !== item.id));
    toast.success("Removed");
    router.refresh();
  }

  const dialogNoun = activeTable
    ? activeTable.isUrl
      ? "webhook link"
      : activeTable.fieldLabel.toLowerCase()
    : "";

  return (
    <TooltipProvider delay={300}>
      <div className="space-y-6">
        {/* Header: title + edit-mode toggle */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-zinc-500" />
              <h1 className="text-2xl font-semibold tracking-tight">
                Dropdown Configuration
              </h1>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Manage the choices for the dropdown-driven table columns. Toggle
              Edit mode to add, rename, or remove options.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
        </div>

        {/* Two-up on wider screens; the option lists are short. */}
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-2">
          {TABLES.map((table) => (
            <ChoiceTableSection
              key={table.id}
              table={table}
              items={itemsByTable[table.id] ?? []}
              editMode={editMode}
              query={queries[table.id] ?? ""}
              onQueryChange={(q) =>
                setQueries((prev) => ({ ...prev, [table.id]: q }))
              }
              onAdd={() => setDialog({ tableId: table.id, existing: null })}
              onEdit={(item) => setDialog({ tableId: table.id, existing: item })}
              onDelete={(item) => handleDelete(table, item)}
              onShowNotes={(n) => setShowingNotes(n)}
            />
          ))}
        </div>

        {activeTable && dialog && (
          <ChoiceDialog
            open={!!dialog}
            onOpenChange={(o) => {
              if (!o) setDialog(null);
            }}
            heading={`${dialog.existing ? "Edit" : "Add"} ${dialogNoun}`}
            description={
              dialog.existing
                ? `Update this ${activeTable.title} option.`
                : `Add a new option to ${activeTable.title}.`
            }
            fieldLabel={activeTable.fieldLabel}
            placeholder={activeTable.placeholder}
            isUrl={activeTable.isUrl}
            initialValue={dialog.existing?.value ?? ""}
            submitLabel={dialog.existing ? "Save changes" : "Add option"}
            showStatus={activeTable.hasStatus}
            statusOptions={GHL_TAG_STATUSES}
            initialStatus={dialog.existing?.status ?? "Unknown"}
            showNotes={activeTable.hasNotes}
            initialNotes={dialog.existing?.notes ?? ""}
            onSubmit={submitDialog}
          />
        )}

        {/* Read-only Notes popup (GHL Tags), mirrors the Purpose popup. */}
        <Dialog
          open={showingNotes !== null}
          onOpenChange={(o) => !o && setShowingNotes(null)}
        >
          <DialogContent className="sm:max-w-md" overlayClassName="bg-black/70">
            <DialogHeader>
              <DialogTitle>Notes</DialogTitle>
            </DialogHeader>
            <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">
              {showingNotes}
            </p>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = status || "Unknown";
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium",
        STATUS_TONE[s] ?? "bg-zinc-100 text-zinc-500",
      )}
    >
      {s}
    </span>
  );
}

function ChoiceTableSection({
  table,
  items,
  editMode,
  query,
  onQueryChange,
  onAdd,
  onEdit,
  onDelete,
  onShowNotes,
}: {
  table: TableDescriptor;
  items: Item[];
  editMode: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onAdd: () => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onShowNotes: (notes: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? items.filter((i) => i.value.toLowerCase().includes(q))
      : items;
    // Status tables (GHL Tags) group by status order (Keep, To Remove, Unknown,
    // Removed), then alphabetize within each group. Others keep the server's
    // plain alphabetical order.
    if (!table.hasStatus) return matched;
    return [...matched].sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) ||
        a.value.localeCompare(b.value),
    );
  }, [items, query, table.hasStatus]);

  // GHL Tags renders a richer multi-column table; the others are simple lists.
  const rich = !!(table.hasStatus || table.hasNotes);

  // Adaptive Notes clamp (GHL Tags): show as many lines of Notes as fit the
  // row's height, which is driven by the FIXED-width Tag cell (measured below,
  // independent of the Notes text, so no measure->expand loop). Mirrors the Per
  // Website Purpose column; min 2 lines.
  const [notesClamp, setNotesClamp] = useState<Record<string, number>>({});
  const tagCellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  useEffect(() => {
    if (!table.hasNotes) return;
    const LINE_PX = 16; // text-xs line-height
    const PAD_Y = 16; // py-2 top + bottom
    const measure = () => {
      const next: Record<string, number> = {};
      for (const [id, el] of tagCellRefs.current) {
        next[id] = Math.max(2, Math.floor((el.clientHeight - PAD_Y) / LINE_PX));
      }
      setNotesClamp((prev) => {
        const keys = Object.keys(next);
        const same =
          keys.length === Object.keys(prev).length &&
          keys.every((k) => prev[k] === next[k]);
        return same ? prev : next;
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [filtered, table.hasNotes]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-800">{table.title}</h2>
          <span className="text-xs text-zinc-400">{items.length}</span>
        </div>
        {/* Always rendered so its space is reserved (revealed in place when Edit
            mode turns on, rather than pushing the table down). */}
        <Button
          size="sm"
          onClick={onAdd}
          className={cn(!editMode && "invisible")}
          tabIndex={editMode ? undefined : -1}
          aria-hidden={!editMode}
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Option
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder={`Search ${table.title.toLowerCase()}…`}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-8"
        />
      </div>

      <Card>
        {/* Viewport-relative height cap so tall lists (e.g. GHL Tags' hundreds
            of rows) scroll inside the card instead of stretching the page.
            overflow-auto gives vertical + horizontal scroll; max-h is the knob. */}
        <CardContent className="max-h-[75vh] overflow-auto p-0">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              {items.length === 0
                ? "No options yet."
                : "No options match your search."}
            </div>
          ) : rich ? (
            <table className="w-full min-w-[560px] text-sm">
              {/* Sticky header: stays pinned while the card scrolls vertically
                  (each th needs its own bg so rows don't show through). */}
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-zinc-50">
                <tr>
                  <th className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left">
                    Tag
                  </th>
                  {table.hasStatus && (
                    <th className="w-[120px] px-3 py-2 text-left">Status</th>
                  )}
                  {table.hasNotes && (
                    <th className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left">
                      Notes
                    </th>
                  )}
                  {/* Delete column always present so toggling Edit mode doesn't
                      reflow the table; the button hides via `invisible`. */}
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={editMode ? () => onEdit(item) : undefined}
                    className={cn(
                      "border-t",
                      editMode && "cursor-pointer hover:bg-zinc-50",
                    )}
                  >
                    {/* Fixed width (break-words wraps an over-long unbroken tag
                        instead of stretching the column, like the Name column).
                        Its height drives the row + the adaptive Notes clamp. */}
                    <td
                      ref={(el) => {
                        if (el) tagCellRefs.current.set(item.id, el);
                        else tagCellRefs.current.delete(item.id);
                      }}
                      className="w-[240px] min-w-[240px] max-w-[240px] break-words px-3 py-2 align-top"
                    >
                      {item.value}
                    </td>
                    {table.hasStatus && (
                      <td className="px-3 py-2 align-top">
                        <StatusBadge status={item.status} />
                      </td>
                    )}
                    {table.hasNotes && (
                      <td className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 align-top">
                        {item.notes ? (
                          <Tooltip disableHoverablePopup>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  disabled={editMode}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onShowNotes(item.notes ?? "");
                                  }}
                                  className="w-full cursor-pointer line-clamp-2 break-words text-left text-xs text-zinc-700 hover:text-zinc-900 hover:underline disabled:pointer-events-none disabled:cursor-default disabled:no-underline"
                                  style={{ WebkitLineClamp: notesClamp[item.id] ?? 2 }}
                                >
                                  {item.notes}
                                </button>
                              }
                            />
                            <TooltipContent className="max-w-xs whitespace-pre-wrap break-words text-left normal-case">
                              {item.notes}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-2 align-top">
                      <button
                        type="button"
                        title="Remove"
                        aria-label="Remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item);
                        }}
                        className={cn(
                          "rounded p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600",
                          !editMode && "invisible",
                        )}
                        tabIndex={editMode ? undefined : -1}
                        aria-hidden={!editMode}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="divide-y">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  onClick={editMode ? () => onEdit(item) : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm",
                    editMode && "cursor-pointer hover:bg-zinc-50",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      table.isUrl && "font-mono text-xs text-zinc-600",
                    )}
                  >
                    {item.value}
                  </span>
                  <button
                    type="button"
                    title="Remove"
                    aria-label="Remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item);
                    }}
                    className={cn(
                      "rounded p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600",
                      !editMode && "invisible",
                    )}
                    tabIndex={editMode ? undefined : -1}
                    aria-hidden={!editMode}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
