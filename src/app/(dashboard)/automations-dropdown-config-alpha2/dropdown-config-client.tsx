"use client";

// =============================================================
// Dropdown Config Alpha2's client: **List and inspector**.
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
import { ListChecks, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DROPDOWN_COLUMNS,
  WEBHOOK_CHOICE_META,
  WEBHOOK_SCOPE,
  CHOICE_COLOR_OPTIONS,
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
import { useFitViewportHeight } from "@/lib/automations/use-fit-viewport-height";
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

export function DropdownConfigAlpha2Client({
  initialChoices,
  initialWebhooks,
}: {
  initialChoices: DropdownChoiceRow[];
  initialWebhooks: WebhookChoiceRow[];
}) {
  const router = useRouter();
  const [choices, setChoices] = useState(initialChoices);
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  // 📌 NO `editMode` STATE ON THIS BENCH. The live page needs one because
  // editing means clicking a row, so a row-click has to be inert the rest of
  // the time. Here the list selects and the inspector edits, so the two never
  // compete and the mode has nothing to guard.
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
  // 📌 `editingSpecial` WAS HERE AND IS GONE. It guarded the dialog against
  // editing a built-in option's value, and the dialog no longer edits anything
  // on this bench. The same rule still applies in the inspector, which reads
  // `isSpecialChoice` for itself.

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
              Alpha2
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Manage the choices for the dropdown-driven table columns. Toggle
            Edit mode to add, rename, or remove options.
          </p>
        </div>

        {/* Tab toolbar: pick which table to view (only the selected one renders),
            with the Edit mode toggle inline at the far right of the same row. */}
        {/* The tab strip is the live page's, unchanged: this bench is about what
            happens BELOW it. Selecting a tab clears the selection, because an
            option from another column has no meaning in this one. */}
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200">
          {TABLES.map((table) => {
            const isActive = table.id === activeTab;
            const count = itemsByTable[table.id]?.length ?? 0;
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => {
                  setActiveTab(table.id);
                  setDialog(null);
                }}
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
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
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
        </div>

        {/* ⭐⭐ NO EDIT MODE TOGGLE ON THIS BENCH, and its absence is the point.
            The live page needs one because editing means clicking a ROW, and a
            row-click has to mean something else the rest of the time. Here the
            list is for selecting and the inspector is for editing, so the two
            never compete and the mode disappears. */}
        <ListInspector
          key={activeDescriptor.id}
          table={activeDescriptor}
          items={itemsByTable[activeDescriptor.id] ?? []}
          selected={
            dialog && dialog.tableId === activeDescriptor.id
              ? dialog.existing
              : null
          }
          query={queries[activeDescriptor.id] ?? ""}
          onQueryChange={(q) =>
            setQueries((prev) => ({ ...prev, [activeDescriptor.id]: q }))
          }
          onSelect={(item) =>
            setDialog({ tableId: activeDescriptor.id, existing: item })
          }
          onAdd={() =>
            setDialog({ tableId: activeDescriptor.id, existing: null })
          }
          onSave={submitDialog}
          onDelete={(item) => handleDelete(activeDescriptor, item)}
          onShowRelationships={(item) =>
            setRelatedLookup({
              kind: activeDescriptor.id === "webhooks" ? "webhook" : "ghlTag",
              anchor: null,
              items: [{ id: item.id, label: item.value }],
            })
          }
        />

        {/* `valueLocked` below: a built-in option's value IS its identity, so
            the field is read-only when editing one. Status and Notes stay
            editable, since neither carries the identity. */}
        {/* ⚠️⚠️ THE MODAL IS THE *ADD* PATH ONLY NOW, hence `!dialog.existing`.
            Editing moved into the inspector, and rendering both would give one
            record two editors that can disagree.
            ⭐ `dialog` DOUBLES AS THE SELECTION on this bench, which is why
            `submitDialog` below works untouched: it reads `dialog.existing` to
            know what it is saving, and the inspector sets exactly that. */}
        {activeTable && dialog && !dialog.existing && (
          <ChoiceDialog
            open={!!dialog}
            onOpenChange={(o) => {
              if (!o) setDialog(null);
            }}
            heading={`Add ${dialogNoun}`}
            description={`Add a new option to ${activeTable.title}.`}
            fieldLabel={activeTable.fieldLabel}
            placeholder={activeTable.placeholder}
            isUrl={activeTable.isUrl}
            initialValue=""
            valueLocked={false}
            statusLocked={false}
            submitLabel="Add option"
            showStatus={activeTable.hasStatus}
            // Always the pickable list here: this dialog only ever ADDS, and
            // "Admin" is not something an ordinary add may choose.
            statusOptions={selectableStatusOptions(
              activeTable.statusOptions ?? [],
            )}
            initialStatus={activeTable.defaultStatus ?? "Unknown"}
            showNotes={activeTable.hasNotes}
            initialNotes=""
            showColors={activeTable.hasColor}
            initialBadgeColor=""
            initialTextColor=""
            onSubmit={submitDialog}
            // ⚠️ NO `onDelete` AT ALL, because this dialog only adds and there
            // is nothing yet to remove. Deleting moved to the inspector, which
            // is the only place an existing option is open.
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

/** A narrow list on the left, the selected option's full detail on the right.
 *
 *  ⭐⭐ WHY THIS SHAPE: the live page puts every field in a COLUMN, so the
 *  table is as wide as the widest record and every row pays for it. At 428 rows
 *  you scroll a 1000px-wide table to read a 30-character tag. Here the scanning
 *  column is ~340px and the detail is read one record at a time, which is how
 *  it is actually used.
 *  📌 AND IT RETIRES THE MODAL. A dialog exists because there is nowhere to put
 *  the fields; give them a pane and the dialog, its open/close state and the
 *  Edit-mode toggle that guards it all stop being necessary. */
function ListInspector({
  table,
  items,
  selected,
  query,
  onQueryChange,
  onSelect,
  onAdd,
  onSave,
  onDelete,
  onShowRelationships,
}: {
  table: TableDescriptor;
  items: Item[];
  selected: Item | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (item: Item) => void;
  onAdd: () => void;
  onSave: (payload: {
    value: string;
    status?: string;
    notes?: string;
    badgeColor?: string | null;
    textColor?: string | null;
  }) => Promise<string | null>;
  onDelete: (item: Item) => void;
  onShowRelationships: (item: Item) => void;
}) {
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

  const { ref: scrollRef, style: scrollStyle } = useFitViewportHeight();

  return (
    <div className="flex gap-4">
      {/* ---- the list ---- */}
      <div className="flex w-[340px] shrink-0 flex-col gap-3">
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
          <CardContent
            ref={scrollRef}
            style={scrollStyle}
            className="max-h-[70vh] overflow-auto p-0"
          >
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                {items.length === 0
                  ? "No options yet."
                  : "No options match your search."}
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((item) => {
                  const isSel = selected?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        aria-current={isSel ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                          isSel
                            ? "bg-zinc-100 font-medium text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-50",
                        )}
                      >
                        {/* A colour DOT rather than the full pill: the list is
                            for scanning names, and 428 pills is a quilt. The
                            pill itself lives in the inspector. */}
                        {table.hasColor && (
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                            style={{
                              backgroundColor:
                                choiceColorHex(item.badgeColor) ?? "#fff",
                            }}
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {item.value}
                        </span>
                        {table.hasStatus && (
                          <StatusBadge
                            status={item.status}
                            options={table.statusOptions ?? []}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Option
        </Button>
      </div>

      {/* ---- the inspector ---- */}
      <div className="min-w-0 flex-1">
        {selected ? (
          // ⚠️ `key` REMOUNTS THE FORM PER SELECTION, which is what lets the
          // fields initialise from props in `useState` instead of syncing in an
          // effect. The effect version trips `react-hooks/set-state-in-effect`
          // and costs a cascading render; this costs nothing.
          <InspectorForm
            key={selected.id}
            table={table}
            item={selected}
            onSave={onSave}
            onDelete={onDelete}
            onShowRelationships={onShowRelationships}
          />
        ) : (
          <Card>
            <CardContent className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
              <ListChecks className="h-6 w-6 text-zinc-300" />
              <p className="text-sm text-zinc-500">
                Select {(table.rowLabel ?? table.fieldLabel).toLowerCase()} on
                the left to edit it.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/** The right pane: every field of one option, editable in place. */
function InspectorForm({
  table,
  item,
  onSave,
  onDelete,
  onShowRelationships,
}: {
  table: TableDescriptor;
  item: Item;
  onSave: (payload: {
    value: string;
    status?: string;
    notes?: string;
    badgeColor?: string | null;
    textColor?: string | null;
  }) => Promise<string | null>;
  onDelete: (item: Item) => void;
  onShowRelationships: (item: Item) => void;
}) {
  const [value, setValue] = useState(item.value);
  const [status, setStatus] = useState(item.status ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [badgeColor, setBadgeColor] = useState(item.badgeColor ?? "");
  const [textColor, setTextColor] = useState(item.textColor ?? "");
  const [saving, setSaving] = useState(false);

  // A built-in option's value IS its identity, so it stays read-only. Same rule
  // the shared dialog applies; see `valueLocked` there.
  const locked = isSpecialChoice(table.id, item.value);
  const statusChoices = selectableStatusOptions(table.statusOptions ?? []);

  const dirty =
    value !== item.value ||
    status !== (item.status ?? "") ||
    notes !== (item.notes ?? "") ||
    badgeColor !== (item.badgeColor ?? "") ||
    textColor !== (item.textColor ?? "");

  async function submit() {
    setSaving(true);
    const err = await onSave({
      value: value.trim(),
      ...(table.hasStatus ? { status } : {}),
      ...(table.hasNotes ? { notes } : {}),
      ...(table.hasColor
        ? { badgeColor: badgeColor || null, textColor: textColor || null }
        : {}),
    });
    setSaving(false);
    if (err) toast.error(err);
  }

  const SELECT =
    "h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900";

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* The live preview: on a colour column the pill is what this
                record actually produces elsewhere in the app, so it belongs at
                the top of its own editor rather than being inferred from two
                colour-name cells. */}
            {table.hasColor ? (
              <ColorPill
                value={value || item.value}
                badgeColor={badgeColor || null}
                textColor={textColor || null}
              />
            ) : (
              <h2 className="truncate text-base font-semibold text-zinc-900">
                {item.value}
              </h2>
            )}
          </div>
          {table.hasRelationships && (
            <button
              type="button"
              onClick={() => onShowRelationships(item)}
              className="shrink-0 text-xs tabular-nums text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              {item.relationships ?? 0} automations use this
            </button>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600">
            {table.fieldLabel}
          </label>
          <Input
            value={value}
            disabled={locked}
            onChange={(e) => setValue(e.target.value)}
            placeholder={table.placeholder}
          />
          {locked && (
            <p className="text-[11px] text-zinc-500">
              Built-in option: the value is its identity and cannot change.
            </p>
          )}
        </div>

        {table.hasStatus && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Status</label>
            {/* 📌 A NATIVE SELECT, on purpose: this is a bench, and the real
                version would reuse the app's combobox standard
                (`docs/dropdown-menu-standard.md`). Rebuilding that here would
                be the most code on the page and would prove nothing about the
                LAYOUT, which is what is being tried. */}
            <select
              className={SELECT}
              value={status}
              disabled={locked}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statusChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value}
                </option>
              ))}
            </select>
          </div>
        )}

        {table.hasColor && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">
                Badge colour
              </label>
              <select
                className={SELECT}
                value={badgeColor}
                onChange={(e) => setBadgeColor(e.target.value)}
              >
                <option value="">None</option>
                {CHOICE_COLOR_OPTIONS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">
                Text colour
              </label>
              <select
                className={SELECT}
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
              >
                <option value="">None</option>
                {CHOICE_COLOR_OPTIONS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {table.hasNotes && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Notes</label>
            {/* Full height, not a truncated cell. On the live page Notes is a
                column you hover to read; here there is room to just show it. */}
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
            />
          </div>
        )}

        <div className="flex items-center gap-2 border-t pt-3">
          <Button size="sm" onClick={submit} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {/* ⚠️ DELETE IS ONLY OFFERED WHERE THE SHARED DIALOG OFFERS IT: a
              built-in option has no bin there either. */}
          {!locked && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => onDelete(item)}
            >
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
