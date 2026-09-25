"use client";

// =============================================================
// Dropdown Config Alpha4's client: **One page, no tabs**.
// =============================================================
// ⚠️⚠️ A FORK OF `@/components/automations/dropdown-config-client`, and the
// STATE, HANDLERS, API CALLS AND DIALOG BELOW ARE THAT FILE'S, UNCHANGED.
// **Only the render layer differs.** Fix a behaviour BUG in the shared one and
// fix it here too; change a LAYOUT there and do not.
// 📌 THE THREE `./` IMPORTS BECAME ABSOLUTE in the copy. `choice-dialog`,
// `related-count` and `related-automations-dialog` are shared LEAVES and are
// meant to be imported; it is the layout in this file that must stay its own.
//
// ⬇️ EVERYTHING BELOW IS THE SHARED CLIENT'S OWN HEADER, INHERITED.
// =============================================================

// Client for the Automations "Dropdown Configuration" page. Shows one table at a
// time (Author, Automation Tags, GHL Tags, GHL Forms, Trigger Event, Webhook
// Links) chosen via a tab toolbar; Author is the default. Each table keeps its
// own search query (preserved when switching tabs). A page-level Edit mode toggle
// reveals the active table's single "Add Option" and row-click editing.
//
// DELETE lives in the Add/Edit dialog (a red bin, bottom-left), NOT in a per-row
// column. It moved there 2026-08-28 at the user's request, the same move the Per
// Website table made in Round 58, so the tables no longer reserve a bin column.
// A built-in option ("No Path", "No Tag", ...) simply gets no bin, because the
// caller only passes `onDelete` when deleting is allowed.
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

import { useMemo, useState } from "react";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
import { ListChecks, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DROPDOWN_COLUMNS,
  WEBHOOK_CHOICE_META,
  WEBHOOK_SCOPE,
  choiceColorHex,
  isSpecialChoice,
  selectableStatusOptions,
  sortSpecialFirst,
  type DropdownChoiceRow,
  type DropdownColumnKey,
  type RelatedAutomation,
  type StatusOption,
  type WebhookChoiceRow,
} from "@/lib/automations/dropdown-config";
import { ChoiceDialog } from "@/components/automations/choice-dialog";
import {
  RelatedAutomationsDialog,
  type RelatedLookupTarget,
} from "@/components/automations/related-automations-dialog";
import { confirmDialog } from "@/components/ui/confirm";

/** A unified row shown in any of the tables. */
interface Item {
  id: string;
  value: string;
  status?: string | null;
  notes?: string | null;
  badgeColor?: string | null;
  textColor?: string | null;
  /** Relationship-bearing tables only (Webhook Links, GHL Tags): count of
   *  automations using this choice. */
  relationships?: number;
  /** Relationship-bearing tables only (Webhook Links, GHL Tags): the automations
   *  using this choice (reverse lookup), rendered inline in the Relationships
   *  cell and opening the browse-all lookup. */
  relatedAutomations?: RelatedAutomation[];
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
  /** Show a "Relationships" column: the automations that use this choice, with a
   *  browse-all lookup. Webhook Links and GHL Tags today. */
  hasRelationships?: boolean;
  /** First-column header for the rich table view ("Tag", "Form", "Author"). */
  rowLabel?: string;
}

// ⚠️ THE USER-FACING FIELDS COME FROM `WEBHOOK_CHOICE_META` in the lib, not
// from literals here. The Add/Edit Workflow dialog's "New link" button describes
// this same table, and one copy is what keeps the two dialogs' wording
// identical. Only the fields THIS table view needs (`rowLabel`,
// `hasRelationships`) are local.
const WEBHOOK_TABLE: TableDescriptor = {
  id: WEBHOOK_SCOPE,
  title: WEBHOOK_CHOICE_META.title,
  fieldLabel: WEBHOOK_CHOICE_META.fieldLabel,
  placeholder: WEBHOOK_CHOICE_META.placeholder,
  isUrl: WEBHOOK_CHOICE_META.isUrl,
  hasNotes: WEBHOOK_CHOICE_META.hasNotes,
  // Rich 3-column table: Webhook Link | Relationships | Notes.
  rowLabel: "Webhook Link",
  hasRelationships: true,
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
    hasRelationships: c.hasRelationships,
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

export function DropdownConfigAlpha4Client({
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
  // 📌 NO SHARED `queries` MAP HERE. The live page keeps one search per tab
  // because one table is visible at a time; this bench shows all seven at once,
  // so each section owns its own box and its own state.
  const [dialog, setDialog] = useState<{
    tableId: string;
    existing: Item | null;
  } | null>(null);
  // The notes text shown in the read-only Notes popup (null = closed).
  const [showingNotes, setShowingNotes] = useState<string | null>(null);
  // The webhook browse-all lookup target (null = closed). Opened from a Webhook
  // Links row's Relationships count; reuses the shared RelatedAutomationsDialog in
  // "all" mode (anchor null → lists every automation using the webhook).
  const [relatedLookup, setRelatedLookup] =
    useState<RelatedLookupTarget | null>(null);

  const itemsByTable = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const t of TABLES) m[t.id] = [];
    // ⚠️ THIS IS AN EXPLICIT FIELD-BY-FIELD COPY, SO IT SILENTLY DROPS ANYTHING
    // YOU FORGET. Every field on DropdownChoiceRow that a table renders MUST be
    // listed here. TypeScript will NOT catch an omission, because Item declares
    // these fields optional, so a short object still type-checks and the cell
    // just renders its empty state.
    //
    // That is exactly what happened when GHL Tags got its Relationships column
    // (fixed 2026-08-22): the server loaded the relationships correctly, this
    // copy dropped them, and every row read "None". Same shape as the Refresh
    // List incident documented in lib/automations/per-website-rows.ts.
    for (const c of choices) {
      (m[c.columnKey] ??= []).push({
        id: c.id,
        value: c.value,
        status: c.status,
        notes: c.notes,
        badgeColor: c.badgeColor,
        textColor: c.textColor,
        // Populated for GHL Tags only (see the page loader); undefined elsewhere,
        // which renders as the "None" empty state on tables that show the column.
        relationships: c.relatedAutomations?.length ?? 0,
        relatedAutomations: c.relatedAutomations,
      });
    }
    m.webhooks = webhooks.map((w) => ({
      id: w.id,
      value: w.url,
      notes: w.notes,
      relationships: w.relationships ?? 0,
      relatedAutomations: w.relatedAutomations,
    }));
    return m;
  }, [choices, webhooks]);

  const activeTable = dialog
    ? (TABLES.find((t) => t.id === dialog.tableId) ?? null)
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
      ? {
          url: payload.value,
          ...(hasNotes ? { notes: payload.notes ?? "" } : {}),
        }
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
    // Close the Add/Edit dialog, which is now where delete is triggered from:
    // the option it was editing no longer exists. (WorkflowDialog's caller does
    // the same with setEditing(null).)
    setDialog(null);
    toast.success("Removed");
    router.refresh();
  }

  const dialogNoun = activeTable
    ? activeTable.isUrl
      ? "webhook link"
      : activeTable.fieldLabel.toLowerCase()
    : "";

  // Is the open dialog editing one of the built-in options? Those rows have two
  // fields that ARE their specialness, the name and the Admin status, so both
  // are locked. Notes stay editable, being the one part meant to be reworded.
  const editingSpecial =
    !!activeTable &&
    !!dialog?.existing &&
    isSpecialChoice(activeTable.id, dialog.existing.value);

  // The table the toolbar is currently showing (falls back to Author).
  const activeDescriptor = TABLES.find((t) => t.id === activeTab) ?? TABLES[0];

  return (
    <TooltipProvider delay={TOOLTIP_DELAY_MS}>
      <div className="space-y-6">
        {/* Header: title + subtitle. The Edit mode toggle now lives just below
            the tab toolbar (above the active table's Add Option button). */}
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Dropdown Configuration
            </h1>
            {/* ⚠️ THE BADGE IS HOW YOU KNOW WHICH BENCH THIS IS. The live
                page has none, and its absence is the tell. */}
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha4
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Manage the choices for the dropdown-driven table columns. Toggle
            Edit mode to add, rename, or remove options.
          </p>
        </div>

        {/* Tab toolbar: pick which table to view (only the selected one renders),
            with the Edit mode toggle inline at the far right of the same row. */}
        {/* ⭐⭐ NO TABS AT ALL. Every column is on the page at once, and the
            strip at the top JUMPS rather than switches.
            📌 WHY: tabs hide six of the seven columns behind a click, and the
            live page's biggest readability problem is that you cannot see the
            shape of the data. Author has 1 option and GHL Tags has 428; stacked,
            that is obvious at a glance, and a one-row column is simply a short
            section instead of a mostly empty screen.
            ⚠️ THE COST IS REAL AND IS PAID BY A CAP: 582 options stacked would be
            an enormous page, so each section shows its first 10 and says how
            many more there are. **A design that only works because you truncated
            the data should say so**, which is what the "Show all" button is. */}
        <div className="sticky top-0 z-20 -mx-6 border-b border-zinc-200 bg-white/95 px-6 py-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-1">
            {TABLES.map((table) => {
              const count = itemsByTable[table.id]?.length ?? 0;
              const isActive = table.id === activeDescriptor.id;
              return (
                <a
                  key={table.id}
                  href={`#dd-${table.id}`}
                  onClick={() => setActiveTab(table.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  {table.title}
                  <span
                    className={cn(
                      "tabular-nums",
                      isActive ? "text-zinc-300" : "text-zinc-400",
                    )}
                  >
                    {count}
                  </span>
                </a>
              );
            })}
            <div className="ml-auto flex items-center gap-2 pl-3 text-xs text-zinc-600">
              <Pencil className="h-3.5 w-3.5" />
              Edit mode
              <Switch checked={editMode} onCheckedChange={setEditMode} />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {TABLES.map((table) => (
            <StackedSection
              key={table.id}
              table={table}
              items={itemsByTable[table.id] ?? []}
              editMode={editMode}
              onAdd={() => setDialog({ tableId: table.id, existing: null })}
              onEdit={(item) =>
                setDialog({ tableId: table.id, existing: item })
              }
              onShowNotes={(n) => setShowingNotes(n)}
              onShowRelationships={(item) =>
                setRelatedLookup({
                  kind: table.id === "webhooks" ? "webhook" : "ghlTag",
                  anchor: null,
                  items: [{ id: item.id, label: item.value }],
                })
              }
            />
          ))}
        </div>

        {/* `valueLocked` below: a built-in option's value IS its identity, so
            the field is read-only when editing one. Status and Notes stay
            editable, since neither carries the identity. */}
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
            valueLocked={editingSpecial}
            statusLocked={editingSpecial}
            submitLabel={dialog.existing ? "Save changes" : "Add option"}
            showStatus={activeTable.hasStatus}
            statusOptions={
              // Locked rows get the FULL list, because the dialog renders their
              // status as a read-only pill and has to find "Admin" in here to
              // style it. Everyone else gets the pickable list, which is what
              // keeps "Admin" out of ordinary hands.
              editingSpecial
                ? (activeTable.statusOptions ?? [])
                : selectableStatusOptions(activeTable.statusOptions ?? [])
            }
            initialStatus={
              dialog.existing?.status ?? activeTable.defaultStatus ?? "Unknown"
            }
            showNotes={activeTable.hasNotes}
            initialNotes={dialog.existing?.notes ?? ""}
            showColors={activeTable.hasColor}
            initialBadgeColor={dialog.existing?.badgeColor ?? ""}
            initialTextColor={dialog.existing?.textColor ?? ""}
            onSubmit={submitDialog}
            // Delete, bottom-left of the dialog. Passed ONLY when there is
            // something to delete and deleting it is allowed: never in add mode
            // (no row yet), and never for a built-in option, which the API
            // refuses anyway. So the bin simply is not there in those cases,
            // exactly how WorkflowDialog omits it in add mode.
            onDelete={
              dialog.existing && !editingSpecial
                ? () => handleDelete(activeTable, dialog.existing!)
                : undefined
            }
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
        <RelatedAutomationsDialog
          target={relatedLookup}
          onOpenChange={(o) => !o && setRelatedLookup(null)}
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
    return (
      <span className="text-sm text-zinc-700 [overflow-wrap:anywhere]">
        {value}
      </span>
    );
  const fg = choiceColorHex(textColor) ?? "#111827";
  return (
    <span
      className="inline-block max-w-full [overflow-wrap:anywhere] rounded-md px-3 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: bg,
        color: fg,
        border: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {value}
    </span>
  );
}

/** One column, rendered in full on the stacked page.
 *
 *  ⚠️ EACH SECTION OWNS ITS OWN SEARCH AND ITS OWN EXPAND STATE. On the live
 *  page there is one search box because there is one visible table; here seven
 *  are on screen, so a single box would be ambiguous about what it filters.
 *  📌 THE SEARCH ONLY APPEARS ABOVE THE CAP. A box over five options is
 *  furniture; over 428 it is the only way in.
 *  ⚠️ NO FIT-TO-VIEWPORT SCROLLER HERE, unlike the live table. Seven nested
 *  scroll areas on one page is the thing that makes long settings pages feel
 *  broken: the wheel stops working where you expect it to. The cap does the job
 *  the scroller was doing. */
const PREVIEW_ROWS = 10;

function StackedSection({
  table,
  items,
  editMode,
  onAdd,
  onEdit,
  onShowNotes,
  onShowRelationships,
}: {
  table: TableDescriptor;
  items: Item[];
  editMode: boolean;
  onAdd: () => void;
  onEdit: (item: Item) => void;
  onShowNotes: (notes: string) => void;
  onShowRelationships: (item: Item) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? items.filter((i) => i.value.toLowerCase().includes(q))
      : items;
    if (!table.statusGrouped) return sortSpecialFirst(table.id, matched);
    const options = table.statusOptions ?? [];
    return [...matched].sort(
      (a, b) =>
        statusRank(a.status, options) - statusRank(b.status, options) ||
        a.value.localeCompare(b.value),
    );
  }, [items, query, table.id, table.statusGrouped, table.statusOptions]);

  const shown = expanded ? filtered : filtered.slice(0, PREVIEW_ROWS);
  const hidden = filtered.length - shown.length;
  const searchable = items.length > PREVIEW_ROWS;

  return (
    // `scroll-mt-16` clears the sticky jump bar: without it, jumping to a
    // section puts its heading underneath the bar.
    <section id={`dd-${table.id}`} className="scroll-mt-16 space-y-2">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">{table.title}</h2>
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-500">
          {items.length}
        </span>
        {searchable && (
          <div className="relative ml-2 w-64">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder={`Search ${table.title.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={onAdd}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              {items.length === 0
                ? "No options yet."
                : "No options match your search."}
            </div>
          ) : (
            <ul className="divide-y">
              {shown.map((item) => {
                const notes = item.notes?.trim();
                return (
                  <li
                    key={item.id}
                    onClick={editMode ? () => onEdit(item) : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-1.5 text-sm",
                      editMode && "cursor-pointer hover:bg-zinc-50",
                    )}
                  >
                    {/* The value keeps the shape it has in the app: a pill on
                        the colour columns, plain text everywhere else. */}
                    <span className="min-w-0 flex-1 truncate">
                      {table.hasColor ? (
                        <ColorPill
                          value={item.value}
                          badgeColor={item.badgeColor}
                          textColor={item.textColor}
                        />
                      ) : (
                        <span className="font-medium text-zinc-900">
                          {item.value}
                        </span>
                      )}
                    </span>
                    {table.hasStatus && (
                      <StatusBadge
                        status={item.status}
                        options={table.statusOptions ?? []}
                      />
                    )}
                    {table.hasRelationships && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowRelationships(item);
                        }}
                        className="shrink-0 text-xs tabular-nums text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                      >
                        {item.relationships ?? 0} used
                      </button>
                    )}
                    {/* Notes are a hover + click, not a column. Across seven
                        stacked sections a Notes column would be seven columns
                        of mostly empty space. */}
                    {notes ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowNotes(notes);
                        }}
                        title={notes}
                        className="max-w-[40%] shrink-0 truncate text-xs text-zinc-500 hover:text-zinc-900"
                      >
                        {notes}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full border-t px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Show all {filtered.length}
              <span className="text-zinc-400"> ({hidden} more)</span>
            </button>
          )}
          {expanded && filtered.length > PREVIEW_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full border-t px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              Show fewer
            </button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
