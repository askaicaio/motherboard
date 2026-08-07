"use client";

// Client for the Automations "Dropdown Configuration" page. Shows one table at a
// time (Author, Automation Tags, GHL Tags, GHL Forms, Trigger Event, Webhook
// Links) chosen via a tab toolbar; Author is the default. Each table keeps its
// own search query (preserved when switching tabs). A page-level Edit mode toggle
// reveals the active table's single "Add Option", row-click editing, and per-row
// delete.
//
// GHL Tags and GHL Forms are richer 3-column tables:
// <rowLabel> | Status (per-column dropdown, default Unknown) | Notes (free text,
// presented + edited like the Per Website Purpose column). Their status set is
// Keep/To Remove/Unknown/Removed, and they group rows by status. Author, Trigger
// Event, and Automation Tags are colour tables: <rowLabel> | Badge Color | Text
// Color | Notes, with the value rendered as a coloured pill (Author's Status
// column was removed 2026-07-29). Webhook Links is a simple single-column list.
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
  choiceColorHex,
  choiceColorLabel,
  type DropdownChoiceRow,
  type DropdownColumnKey,
  type StatusOption,
  type WebhookChoiceRow,
} from "@/lib/automations/dropdown-config";
import { useFitViewportHeight } from "@/lib/automations/use-fit-viewport-height";
import { ChoiceDialog } from "./choice-dialog";
import {
  WebhookRelatedDialog,
  type WebhookLookupTarget,
} from "./webhook-related-dialog";
import { confirmDialog } from "@/components/ui/confirm";

/** A unified row shown in any of the tables. */
interface Item {
  id: string;
  value: string;
  status?: string | null;
  notes?: string | null;
  badgeColor?: string | null;
  textColor?: string | null;
  /** Webhook Links only: count of automations using this webhook. */
  relationships?: number;
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
  /** This column's Status choices + tones (present iff hasStatus). */
  statusOptions?: StatusOption[];
  /** Default status for a new entry (present iff hasStatus). */
  defaultStatus?: string;
  /** Group rows by status order (GHL Tags/Forms); omit → plain alphabetical. */
  statusGrouped?: boolean;
  hasNotes?: boolean;
  /** Rows carry Badge + Text colours; value renders as a pill (Trigger Event). */
  hasColor?: boolean;
  /** Webhook Links only: show a numeric "Relationships" column (count of
   *  automations using each webhook). */
  hasRelationships?: boolean;
  /** First-column header for the rich table view ("Tag", "Form", "Author"). */
  rowLabel?: string;
}

const WEBHOOK_TABLE: TableDescriptor = {
  id: "webhooks",
  title: "Webhook Links",
  fieldLabel: "Webhook URL",
  placeholder: "https://…",
  isUrl: true,
  // Rich 3-column table: Webhook Link | Relationships | Notes.
  rowLabel: "Webhook Link",
  hasRelationships: true,
  hasNotes: true,
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
    statusOptions: c.statusOptions,
    defaultStatus: c.defaultStatus,
    statusGrouped: c.statusGrouped,
    hasNotes: c.hasNotes,
    hasColor: c.hasColor,
    rowLabel: c.rowLabel,
  })),
  WEBHOOK_TABLE,
];

// Sort rank for a status-grouped table. A column's `statusOptions` already list
// the desired top-to-bottom group order; anything unrecognized (incl. null)
// sorts last. Null is shown as "Unknown" (see StatusBadge), so treat it as such.
function statusRank(
  status: string | null | undefined,
  options: StatusOption[],
): number {
  const key = status || "Unknown";
  const i = options.findIndex((o) => o.value === key);
  return i === -1 ? options.length : i;
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
  // Which table the toolbar is showing. Author (TABLES[0]) is the default.
  const [activeTab, setActiveTab] = useState<string>(TABLES[0].id);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<{
    tableId: string;
    existing: Item | null;
  } | null>(null);
  // The notes text shown in the read-only Notes popup (null = closed).
  const [showingNotes, setShowingNotes] = useState<string | null>(null);
  // The webhook browse-all lookup target (null = closed). Opened from a Webhook
  // Links row's Relationships count; reuses the shared WebhookRelatedDialog in
  // "all" mode (anchor null → lists every automation using the webhook).
  const [webhookLookup, setWebhookLookup] = useState<WebhookLookupTarget | null>(
    null,
  );

  const itemsByTable = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const t of TABLES) m[t.id] = [];
    for (const c of choices) {
      (m[c.columnKey] ??= []).push({
        id: c.id,
        value: c.value,
        status: c.status,
        notes: c.notes,
        badgeColor: c.badgeColor,
        textColor: c.textColor,
      });
    }
    m.webhooks = webhooks.map((w) => ({
      id: w.id,
      value: w.url,
      notes: w.notes,
      relationships: w.relationships ?? 0,
    }));
    return m;
  }, [choices, webhooks]);

  const activeTable = dialog
    ? TABLES.find((t) => t.id === dialog.tableId) ?? null
    : null;

  async function submitDialog(payload: {
    value: string;
    status?: string;
    notes?: string;
    badgeColor?: string | null;
    textColor?: string | null;
  }): Promise<string | null> {
    if (!dialog || !activeTable) return "No table selected";
    const isEdit = !!dialog.existing;
    const isWebhook = activeTable.id === "webhooks";
    const hasStatus = !!activeTable.hasStatus;
    const hasNotes = !!activeTable.hasNotes;
    const hasColor = !!activeTable.hasColor;

    const endpoint = isWebhook
      ? isEdit
        ? `/api/automations/webhook-choices/${dialog.existing!.id}`
        : "/api/automations/webhook-choices"
      : isEdit
        ? `/api/automations/dropdown-choices/${dialog.existing!.id}`
        : "/api/automations/dropdown-choices";
    const method = isEdit ? "PATCH" : "POST";
    const body = isWebhook
      ? { url: payload.value, ...(hasNotes ? { notes: payload.notes ?? "" } : {}) }
      : {
          ...(isEdit ? {} : { columnKey: activeTable.id }),
          value: payload.value,
          ...(hasStatus ? { status: payload.status } : {}),
          ...(hasNotes ? { notes: payload.notes ?? "" } : {}),
          ...(hasColor
            ? {
                badgeColor: payload.badgeColor ?? null,
                textColor: payload.textColor ?? null,
              }
            : {}),
        };

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: {
      error?: string;
      choice?: {
        id: string;
        status?: string | null;
        notes?: string | null;
        badgeColor?: string | null;
        textColor?: string | null;
      };
      webhook?: { id: string; notes?: string | null };
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
          ? prev.map((w) =>
              w.id === saved.id
                ? { ...w, url: payload.value, notes: saved.notes }
                : w,
            )
          : [
              {
                id: saved.id,
                url: payload.value,
                notes: saved.notes,
                relationships: 0,
              },
              ...prev,
            ],
      );
    } else {
      const saved = data.choice;
      if (!saved) return "Save failed";
      const columnKey = activeTable.id as DropdownColumnKey;
      setChoices((prev) =>
        isEdit
          ? prev.map((c) =>
              c.id === saved.id
                ? {
                    ...c,
                    value: payload.value,
                    status: saved.status,
                    notes: saved.notes,
                    badgeColor: saved.badgeColor,
                    textColor: saved.textColor,
                  }
                : c,
            )
          : [
              {
                id: saved.id,
                columnKey,
                value: payload.value,
                status: saved.status,
                notes: saved.notes,
                badgeColor: saved.badgeColor,
                textColor: saved.textColor,
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
    if (
      !(await confirmDialog({
        title: "Remove option",
        body: `Remove ${shown} from ${table.title}?`,
        confirmLabel: "Remove",
        destructive: true,
      }))
    )
      return;
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

  // The table the toolbar is currently showing (falls back to Author).
  const activeDescriptor =
    TABLES.find((t) => t.id === activeTab) ?? TABLES[0];

  return (
    <TooltipProvider delay={300}>
      <div className="space-y-6">
        {/* Header: title + subtitle. The Edit mode toggle now lives just below
            the tab toolbar (above the active table's Add Option button). */}
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

        {/* Tab toolbar: pick which table to view (only the selected one renders),
            with the Edit mode toggle inline at the far right of the same row. */}
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200">
          {TABLES.map((table) => {
            const isActive = table.id === activeTab;
            const count = itemsByTable[table.id]?.length ?? 0;
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => setActiveTab(table.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
                )}
              >
                {table.title}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    isActive
                      ? "bg-zinc-200 text-zinc-700"
                      : "bg-zinc-100 text-zinc-400",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {/* Edit mode toggle, inline at the far right of the toolbar row and
              still above the active table's Add Option button. */}
          <div className="ml-auto flex items-center gap-2 pl-3 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
        </div>

        {/* Only the selected table renders. Each table's search query persists
            in `queries`, so switching tabs and back restores its search. The
            `key` remounts the section per tab, re-measuring the adaptive Notes
            clamp for GHL Tags. */}
        <ChoiceTableSection
          key={activeDescriptor.id}
          table={activeDescriptor}
          items={itemsByTable[activeDescriptor.id] ?? []}
          editMode={editMode}
          query={queries[activeDescriptor.id] ?? ""}
          onQueryChange={(q) =>
            setQueries((prev) => ({ ...prev, [activeDescriptor.id]: q }))
          }
          onAdd={() => setDialog({ tableId: activeDescriptor.id, existing: null })}
          onEdit={(item) =>
            setDialog({ tableId: activeDescriptor.id, existing: item })
          }
          onDelete={(item) => handleDelete(activeDescriptor, item)}
          onShowNotes={(n) => setShowingNotes(n)}
          onShowRelationships={(item) =>
            setWebhookLookup({
              anchor: null,
              webhooks: [{ id: item.id, url: item.value }],
            })
          }
        />

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
            statusOptions={activeTable.statusOptions ?? []}
            initialStatus={
              dialog.existing?.status ?? activeTable.defaultStatus ?? "Unknown"
            }
            showNotes={activeTable.hasNotes}
            initialNotes={dialog.existing?.notes ?? ""}
            showColors={activeTable.hasColor}
            initialBadgeColor={dialog.existing?.badgeColor ?? ""}
            initialTextColor={dialog.existing?.textColor ?? ""}
            onSubmit={submitDialog}
          />
        )}

        {/* Read-only Notes popup (GHL Tags), mirrors the Purpose popup exactly:
            a flex column with a scrollable body (default light overlay, no
            overlayClassName), so `break-words` wraps a long unbroken string
            inside the popup instead of overflowing it. */}
        <Dialog
          open={showingNotes !== null}
          onOpenChange={(o) => !o && setShowingNotes(null)}
        >
          <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Notes</DialogTitle>
            </DialogHeader>
            <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm text-zinc-700">
              {showingNotes}
            </p>
          </DialogContent>
        </Dialog>

        {/* Webhook browse-all "related automations" lookup (opened from a Webhook
            Links row's Relationships count). Same dialog as the table lookup, in
            "all" mode: lists every automation using the webhook. */}
        <WebhookRelatedDialog
          target={webhookLookup}
          onOpenChange={(o) => !o && setWebhookLookup(null)}
        />
      </div>
    </TooltipProvider>
  );
}

function StatusBadge({
  status,
  options,
}: {
  status?: string | null;
  options: StatusOption[];
}) {
  const s = status || "Unknown";
  const badge = options.find((o) => o.value === s)?.badge;
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium",
        badge ?? "bg-zinc-100 text-zinc-500",
      )}
    >
      {s}
    </span>
  );
}

/** The value rendered as a coloured pill using the choice's badge + text colour
 *  keys (inline hex, so it's independent of the app's pale pill classes). No
 *  badge colour set → plain text. A faint inline border keeps white/light pills
 *  visible on the white card. */
function ColorPill({
  value,
  badgeColor,
  textColor,
}: {
  value: string;
  badgeColor?: string | null;
  textColor?: string | null;
}) {
  const bg = choiceColorHex(badgeColor);
  // [overflow-wrap:anywhere] (NOT break-words) so a long unbroken token wraps
  // inside the column instead of stretching it — see
  // [[long-word-overflow-wrap-anywhere]].
  if (!bg)
    return <span className="text-sm text-zinc-700 [overflow-wrap:anywhere]">{value}</span>;
  const fg = choiceColorHex(textColor) ?? "#111827";
  return (
    <span
      className="inline-block max-w-full [overflow-wrap:anywhere] rounded-md px-3 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bg, color: fg, border: "1px solid rgba(0,0,0,0.08)" }}
    >
      {value}
    </span>
  );
}

/** A "Badge Color" / "Text Color" cell: a swatch + the colour's name, or a
 *  muted dash when unset. */
function ColorCell({ colorKey }: { colorKey?: string | null }) {
  const hex = choiceColorHex(colorKey);
  if (!hex) return <span className="text-xs text-zinc-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-700">
      <span
        className="h-4 w-4 shrink-0 rounded"
        style={{ backgroundColor: hex, border: "1px solid rgba(0,0,0,0.12)" }}
      />
      {choiceColorLabel(colorKey)}
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
  onShowRelationships,
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
  onShowRelationships: (item: Item) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? items.filter((i) => i.value.toLowerCase().includes(q))
      : items;
    // Status-GROUPED tables (GHL Tags, GHL Forms) group by their status order,
    // then alphabetize within each group. Every other table (incl. Author, which
    // has a Status column but is NOT grouped) keeps the server's plain
    // alphabetical order.
    if (!table.statusGrouped) return matched;
    const options = table.statusOptions ?? [];
    return [...matched].sort(
      (a, b) =>
        statusRank(a.status, options) - statusRank(b.status, options) ||
        a.value.localeCompare(b.value),
    );
  }, [items, query, table.statusGrouped, table.statusOptions]);

  // Rich (multi-column) table when a column carries Status, Notes, Colour, or
  // Relationships; otherwise a simple single-column list.
  const rich = !!(
    table.hasStatus ||
    table.hasNotes ||
    table.hasColor ||
    table.hasRelationships
  );

  // Adaptive Notes clamp (GHL Tags): show as many lines of Notes as fit the
  // row's height, which is driven by the Tag cell (measured below, independent
  // of the Notes text, so no measure->expand loop). Mirrors the Per Website
  // Purpose column; min 2 lines.
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

  // Fit-to-viewport height for the scroll container (shared hook).
  const { ref: scrollRef, style: scrollStyle } = useFitViewportHeight();

  return (
    <section className="space-y-3">
      {/* Per-table search + the single "Add Option" for the active table. The
          button is always rendered so its space is reserved; Edit mode reveals
          it in place rather than reflowing the row. */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder={`Search ${table.title.toLowerCase()}…`}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-8"
          />
        </div>
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

      <Card>
        {/* Tall lists (e.g. GHL Tags' hundreds of rows) scroll inside the card
            instead of stretching the page. overflow-auto gives vertical +
            horizontal scroll. Height is fit-to-viewport (inline maxHeight,
            measured above) so the card bottom lands near the window bottom; the
            max-h-[75vh] class is the pre-measurement fallback. */}
        <CardContent
          ref={scrollRef}
          style={scrollStyle}
          className="max-h-[75vh] overflow-auto p-0"
        >
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              {items.length === 0
                ? "No options yet."
                : "No options match your search."}
            </div>
          ) : rich ? (
            /* table-fixed: the Tag (first) column is fixed at 400px like the
               Name column on the Per Website + Error History tables; Notes has no
               width, so table-fixed gives it the leftover width (it flexes).
               Status + the delete column stay fixed, delete pinned at the right.
               A long unbroken value wraps (break-words) inside its column. The
               min-w keeps Notes from collapsing on a narrow viewport. */
            <table className="w-full min-w-[800px] table-fixed text-sm">
              {/* Sticky header: stays pinned while the card scrolls vertically
                  (each th needs its own bg so rows don't show through). */}
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-zinc-50">
                <tr>
                  {/* First column ("Tag" for GHL Tags, "Form" for GHL Forms):
                      fixed 400px (mirrors the Name column on the Per Website +
                      Error History tables). Notes below has no width, so
                      table-fixed gives it the leftover width (it flexes). */}
                  <th className="w-[400px] min-w-[400px] max-w-[400px] px-3 py-2 text-left">
                    {table.rowLabel}
                  </th>
                  {table.hasStatus && (
                    <th className="w-[120px] px-3 py-2 text-left">Status</th>
                  )}
                  {table.hasColor && (
                    <>
                      {/* Badge + Text Color: fixed 120px each. Rendered BEFORE
                          Notes so on the colour tables (Trigger Event, Author)
                          they sit right after the value and Notes is the last,
                          flexing column (4th column). */}
                      <th className="w-[120px] px-3 py-2 text-left">Badge Color</th>
                      <th className="w-[120px] px-3 py-2 text-left">Text Color</th>
                    </>
                  )}
                  {/* Relationships (Webhook Links): a numeric count, centered,
                      120px. Sits between the value and Notes. */}
                  {table.hasRelationships && (
                    <th className="w-[120px] px-3 py-2 text-center">Relationships</th>
                  )}
                  {table.hasNotes && (
                    <th className="px-3 py-2 text-left">Notes</th>
                  )}
                  {/* Spacer: only needed when a colour block has NO Notes column
                      to flex; a no-width col absorbs the leftover so the fixed
                      columns hold (first column stays 400px, not stretched). */}
                  {table.hasColor && !table.hasNotes && (
                    <th className="px-3 py-2" />
                  )}
                  {/* Delete column: fixed width, pinned right (last column),
                      always present so toggling Edit mode doesn't reflow the
                      table; the button hides via `invisible`. */}
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
                    {/* Fixed 400px, mirroring the Name column on the Per Website
                        + Error History tables. break-words wraps an over-long
                        unbroken tag inside the column. Its height still drives
                        the row + the adaptive Notes clamp. */}
                    <td
                      ref={(el) => {
                        if (el) tagCellRefs.current.set(item.id, el);
                        else tagCellRefs.current.delete(item.id);
                      }}
                      className="w-[400px] min-w-[400px] max-w-[400px] break-words px-3 py-2 align-top"
                    >
                      {table.hasColor ? (
                        <ColorPill
                          value={item.value}
                          badgeColor={item.badgeColor}
                          textColor={item.textColor}
                        />
                      ) : (
                        item.value
                      )}
                    </td>
                    {table.hasStatus && (
                      <td className="px-3 py-2 align-top">
                        <StatusBadge
                          status={item.status}
                          options={table.statusOptions ?? []}
                        />
                      </td>
                    )}
                    {table.hasColor && (
                      <>
                        <td className="w-[120px] px-3 py-2 align-top">
                          <ColorCell colorKey={item.badgeColor} />
                        </td>
                        <td className="w-[120px] px-3 py-2 align-top">
                          <ColorCell colorKey={item.textColor} />
                        </td>
                      </>
                    )}
                    {/* Relationships (Webhook Links): count of automations using
                        this webhook. When > 0 it's a button opening the browse-all
                        lookup (all automations using it); muted, non-clickable 0
                        otherwise. Disabled in edit mode so the row's edit-click
                        falls through (mirrors the Notes button). Centered, 120px. */}
                    {table.hasRelationships && (
                      <td className="w-[120px] px-3 py-2 text-center align-top">
                        {(item.relationships ?? 0) > 0 ? (
                          <button
                            type="button"
                            disabled={editMode}
                            title="Show related automations"
                            onClick={(e) => {
                              e.stopPropagation();
                              onShowRelationships(item);
                            }}
                            className="cursor-pointer text-xs font-medium text-zinc-900 hover:underline disabled:pointer-events-none disabled:cursor-default disabled:no-underline"
                          >
                            {item.relationships}
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">0</span>
                        )}
                      </td>
                    )}
                    {table.hasNotes && (
                      <td className="px-3 py-2 align-top">
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
                            <TooltipContent className="max-w-xs whitespace-pre-wrap text-left normal-case">
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
                    {/* Spacer: only when colour block has no Notes to flex. */}
                    {table.hasColor && !table.hasNotes && (
                      <td className="px-3 py-2" />
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
            <div>
              {/* Sticky column header naming the single column (e.g. "Trigger
                  Event"), matching the rich tables' header row. Simple lists had
                  no header before, which read as an unnamed column.
                  `font-bold`: the other tables' headers are <th> cells, which the
                  browser renders bold by default (Tailwind Preflight doesn't reset
                  th), so this <div> needs it explicitly to match their weight. */}
              <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                {table.rowLabel ?? table.title}
              </div>
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
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
