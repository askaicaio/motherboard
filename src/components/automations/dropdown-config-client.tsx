"use client";

// Client for the Automations "Dropdown Configuration" page. Renders one table
// per dropdown-driven column (Author, Automation Tags, GHL Tags, Trigger Event)
// plus a Webhook Links table, each with its own search bar. A page-level Edit
// mode toggle (styled like the Per Website / Subscriptions toggle) reveals the
// per-table "Add Option" button, row-click editing, and per-row delete.
//
// The four generic columns write to /api/automations/dropdown-choices; Webhook
// Links writes to /api/automations/webhook-choices. Editing is off by default.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DROPDOWN_COLUMNS,
  type DropdownChoiceRow,
  type DropdownColumnKey,
  type WebhookChoiceRow,
} from "@/lib/automations/dropdown-config";
import { ChoiceDialog } from "./choice-dialog";

/** A unified row shown in any of the tables. */
interface Item {
  id: string;
  value: string;
}

/** Describes one table on the page. */
interface TableDescriptor {
  /** Column key for the generic tables, or "webhooks". */
  id: string;
  title: string;
  fieldLabel: string;
  placeholder: string;
  /** true → the value is a URL (url input + validation, monospace display). */
  isUrl: boolean;
  ghlOnly?: boolean;
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
  })),
  WEBHOOK_TABLE,
];

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
  // Active dialog: which table, and the item being edited (null → adding).
  const [dialog, setDialog] = useState<{
    tableId: string;
    existing: Item | null;
  } | null>(null);

  // Group items under each table id.
  const itemsByTable = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const t of TABLES) m[t.id] = [];
    for (const c of choices) {
      (m[c.columnKey] ??= []).push({ id: c.id, value: c.value });
    }
    m.webhooks = webhooks.map((w) => ({ id: w.id, value: w.url }));
    return m;
  }, [choices, webhooks]);

  const activeTable = dialog
    ? TABLES.find((t) => t.id === dialog.tableId) ?? null
    : null;

  // Create or edit the value for the active dialog's table. Returns an error
  // message, or null on success (also patching local state + refreshing).
  async function submitDialog(value: string): Promise<string | null> {
    if (!dialog || !activeTable) return "No table selected";
    const isEdit = !!dialog.existing;
    const isWebhook = activeTable.id === "webhooks";

    const endpoint = isWebhook
      ? isEdit
        ? `/api/automations/webhook-choices/${dialog.existing!.id}`
        : "/api/automations/webhook-choices"
      : isEdit
        ? `/api/automations/dropdown-choices/${dialog.existing!.id}`
        : "/api/automations/dropdown-choices";
    const method = isEdit ? "PATCH" : "POST";
    const body = isWebhook
      ? { url: value }
      : isEdit
        ? { value }
        : { columnKey: activeTable.id, value };

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: {
      error?: string;
      choice?: { id: string };
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
          ? prev.map((w) => (w.id === saved.id ? { id: saved.id, url: value } : w))
          : [{ id: saved.id, url: value }, ...prev],
      );
    } else {
      const saved = data.choice;
      if (!saved) return "Save failed";
      const columnKey = activeTable.id as DropdownColumnKey;
      setChoices((prev) =>
        isEdit
          ? prev.map((c) => (c.id === saved.id ? { ...c, value } : c))
          : [{ id: saved.id, columnKey, value }, ...prev],
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
            Manage the choices for the dropdown-driven table columns. Toggle Edit
            mode to add, rename, or remove options.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Pencil className="h-3.5 w-3.5" />
          Edit mode
          <Switch checked={editMode} onCheckedChange={setEditMode} />
        </div>
      </div>

      {/* One section per table */}
      <div className="space-y-8">
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
          onSubmit={submitDialog}
        />
      )}
    </div>
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
}: {
  table: TableDescriptor;
  items: Item[];
  editMode: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onAdd: () => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.value.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-800">{table.title}</h2>
          {table.ghlOnly && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              GHL only
            </span>
          )}
          <span className="text-xs text-zinc-400">{items.length}</span>
        </div>
        {editMode && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add Option
          </Button>
        )}
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
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              {items.length === 0
                ? "No options yet."
                : "No options match your search."}
            </div>
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
                  {editMode && (
                    <button
                      type="button"
                      title="Remove"
                      aria-label="Remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item);
                      }}
                      className="rounded p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
