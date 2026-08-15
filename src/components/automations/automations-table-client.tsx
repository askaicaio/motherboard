"use client";

// Per Website Page, header (auto-refresh toggle + "Refresh List" + Export CSV +
// edit-mode toggle), a search row (search bar + Filter + "+ New Workflow"), and
// the automations table. The Name cell
// shows the name with the automation's link beneath it (the link is still its
// identity; it's just no longer a separate column). Search filters by NAME or LINK.
//
// Edit mode (the toggle, top-right): when ON it makes table rows clickable
// (click a row to edit it). When OFF the table is read-only. Add/Edit happen in
// the WorkflowDialog.
//
// Auto-refresh mode (the toggle, far left of the toolbar): Option A. Turning
// it ON anchors a 24h countdown to now; the background cron refreshes the list
// once it elapses, then resets the countdown. Re-toggling restarts the 24h.
// Blocked (with a red error) on platforms with no API integration.

import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { useFitViewportHeight } from "@/lib/automations/use-fit-viewport-height";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Filter,
  ChevronDown,
  ChevronLeft,
  X,
  Loader2,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
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
import { ColorBadge } from "./color-badge";
import {
  WebhookRelatedDialog,
  type WebhookLookupTarget,
} from "./webhook-related-dialog";
import { confirmDialog } from "@/components/ui/confirm";
import { columnVisibleOnPlatform } from "@/lib/automations/dropdown-config";
import type {
  ChoiceOption,
  SelectedChoice,
  SelectedWebhook,
} from "@/lib/automations/dropdown-config";

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
type SortKey =
  | "name"
  | "status"
  | "lastEditedAt"
  | "lastRunAt"
  | "lastErrorAt"
  | "author";

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

// Interactive affordance shared by clickable headers (sortable ones off edit
// mode, and EVERY header while edit mode is on).
const HEADER_INTERACTIVE =
  "cursor-pointer select-none transition-colors hover:bg-zinc-200 hover:text-zinc-700";

/** A column header cell.
 *
 *  OFF edit mode: behaves exactly as before. Sortable headers (a non-null
 *  `sortKey`) click to CYCLE the sort and carry the hover affordance (already in
 *  their `className`); the rest are inert plain headers.
 *
 *  ON edit mode: EVERY header instead hosts a full-width dropdown-trigger BUTTON
 *  inside the (still fixed-width) cell, so clicking it opens an options menu in
 *  place of the plain sort-cycle click. "Cycle Sort" runs the same sort cycle and
 *  is disabled on non-sortable columns; "Move Column Left/Right" are placeholders
 *  (labels only for now, behavior TBD). */
function ColumnHeader({
  className,
  editMode,
  sortKey,
  activeSortKey,
  sortDir,
  onCycleSort,
  onMoveLeft,
  onMoveRight,
  onResetOrder,
  children,
}: {
  className: string;
  editMode: boolean;
  sortKey: SortKey | null;
  activeSortKey: SortKey;
  sortDir: "asc" | "desc";
  onCycleSort: (key: SortKey) => void;
  /** Provided (enabled) when the column can move that way; omit to disable the
   *  item (pinned column, or already at the edge). */
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  /** Reset ALL columns to their default arrangement (table-wide action). */
  onResetOrder?: () => void;
  children: ReactNode;
}) {
  const ariaSort = sortKey
    ? activeSortKey === sortKey
      ? sortDir === "asc"
        ? "ascending"
        : "descending"
      : "none"
    : undefined;

  // Mirror the cell's own text-align onto the trigger button so the label sits
  // exactly where the static header puts it (Name is left, the rest center).
  const alignClass = className.includes("text-left") ? "text-left" : "text-center";

  if (!editMode) {
    // The passed className already carries the interactive classes for sortable
    // headers (and omits them for the rest), so behavior is byte-for-byte as before.
    return (
      <th
        onClick={sortKey ? () => onCycleSort(sortKey) : undefined}
        aria-sort={ariaSort}
        className={className}
      >
        {children}
      </th>
    );
  }

  // Edit mode: keep the <th> a plain, fixed-width cell (p-0) and put a full-width
  // BUTTON inside it as the dropdown trigger. Rendering the <th> ITSELF as the
  // trigger (Base UI `render`) broke both behaviors: a non-button trigger opened
  // only on press-and-hold (released = closed), and the <th> stopped honoring its
  // fixed width once it became the menu's anchor. A real <button> (the standard
  // trigger, matching every other dropdown) fixes both. The button carries the
  // padding + interactive affordance; the cell keeps its width/sticky/shadow.
  return (
    <th aria-sort={ariaSort} className={cn(className, "p-0")}>
      <DropdownMenu>
        <DropdownMenuTrigger
          // `uppercase` re-applies the header text-transform that the <button>
          // reset strips (Tailwind preflight sets `text-transform: none` on
          // buttons), so the trigger label stays uppercase like the static <th>.
          className={cn(
            "block w-full px-3 py-2 uppercase",
            alignClass,
            HEADER_INTERACTIVE,
          )}
        >
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-auto min-w-48">
          {/* Cycle Sort, shown ONLY on sortable columns (hidden on the
              display-only ones instead of appearing disabled/grayed). */}
          {sortKey && (
            <DropdownMenuItem onClick={() => onCycleSort(sortKey)}>
              <ArrowDownUp />
              Cycle Sort
            </DropdownMenuItem>
          )}
          {/* Move the column left/right, shown ONLY when it can actually go that
              way. So both are hidden on the pinned Name column (nothing to move),
              and the edge item is hidden on the first / last movable column. */}
          {onMoveLeft && (
            <DropdownMenuItem onClick={onMoveLeft}>
              <ArrowLeft />
              Move Column Left
            </DropdownMenuItem>
          )}
          {onMoveRight && (
            <DropdownMenuItem onClick={onMoveRight}>
              <ArrowRight />
              Move Column Right
            </DropdownMenuItem>
          )}
          {/* Reset ALL columns to the default arrangement (table-wide action),
              at the bottom, below the per-column sort/move items. Black-filled
              (white text + icon) to match the app's dark buttons; the `!`
              overrides the base item's focus/descendant colour rules. */}
          {onResetOrder && (
            <DropdownMenuItem
              onClick={onResetOrder}
              className="!bg-primary !text-primary-foreground [&_svg]:!text-primary-foreground focus:!bg-primary/80"
            >
              <RotateCcw />
              Reset Column Order
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </th>
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
// URL too). Purpose, Author, Notes and Trigger Event are never synced on any
// platform (manual only), so they never appear here.
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
  notes?: string | null; // second optional free-text note (mirrors purpose)
  // When the automation last ran on its source platform. Sync-only (never set
  // manually). Date on initial server render, ISO string after a sync/poll.
  lastRunAt?: string | Date | null;
  // When the automation was last edited on its source platform. Sync/import-only
  // (never set via the dialog). Date on initial server render, ISO string after
  // a sync/poll. Populated for all synced platforms (n8n/GHL `updatedAt`, Make
  // `lastEdit`); "-" only until a row has been synced or has no value yet.
  lastEditedAt?: string | Date | null;
  // Latest captured error date for this automation, from the automation_errors
  // table (Make + n8n write it; fed by getLastErrorAtByPlatform in the page
  // loader). Null when the row has no captured error, so the cell shows "-"
  // (also the case for GHL, which has no error API, and Zapier, out of scope).
  // Rendered in RED (unlike the other date columns).
  lastErrorAt?: string | Date | null;
  // Author (single-select dropdown column). `authorChoiceId` is the stored
  // automation_dropdown_choices id; `author` is its resolved display value
  // (both null when unset). Set via the Add/Edit Workflow dialog only; never
  // synced. The value comes pre-resolved from the page's join (server render)
  // or from the loaded choices (after a dialog save).
  authorChoiceId?: string | null;
  author?: string | null;
  // The selected Author choice's badge + text colour keys (resolved from the
  // choices table), so the Author cell can render a coloured pill (mirrors
  // Trigger Event). Null when unset / no colour chosen.
  authorBadgeColor?: string | null;
  authorTextColor?: string | null;
  // Trigger Event (single-select dropdown column, mirrors Author).
  // `triggerEventChoiceId` is the stored choice id; `triggerEvent` is its
  // resolved display value (both null when unset). Manual only; never synced.
  triggerEventChoiceId?: string | null;
  triggerEvent?: string | null;
  // The selected Trigger Event choice's badge + text colour keys (resolved from
  // the choices table), so the cell can render a coloured pill.
  triggerEventBadgeColor?: string | null;
  triggerEventTextColor?: string | null;
  // Automation Tags (MULTI-select dropdown column). The set of selected tag
  // choices (id + value + colours), resolved from the junction; rendered as
  // wrapping coloured chips. Empty array when none. Set only via the Add/Edit
  // Workflow dialog, never by a sync.
  automationTags?: SelectedChoice[];
  // GHL Tags + GHL Forms (MULTI-select dropdown columns, GHL-gated). The selected
  // choices resolved from the generic junction; rendered as plain-text lines (one
  // per value, like Webhook Links), NOT chips. Only populated on GHL / GHL b2b
  // rows. Set only via the Add/Edit Workflow dialog, never by a sync.
  ghlTags?: SelectedChoice[];
  ghlForms?: SelectedChoice[];
  // Webhook Links (MULTI-select dropdown column). The selected webhook choices
  // (id + url), resolved from the automation_webhooks junction; rendered one
  // truncated line per webhook. Empty array when none. Set only via the Add/Edit
  // Workflow dialog, never by a sync.
  webhooks?: SelectedWebhook[];
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
// `platforms` (optional): restrict a column to those platform slugs, mirroring the
// on-screen platform-gated columns (GHL Tags / GHL Forms). Omitted = every export.
// ---------------------------------------------------------------------------
// The reorderable MIDDLE columns (everything between the frozen Name column and
// the Actions column). ONE source of truth that drives the header, the body
// cells, the CSV export, AND the user-facing reorder (Move Column Left/Right).
// Name (pinned first, frozen) and Actions (pinned last) are NOT in this list.

// Shared header <th> class strings (widths + sticky + text-align; the sortable
// ones also carry the interactive cursor/hover classes, matching the old
// inline headers byte-for-byte).
const TH_SORTABLE_AUTO =
  "sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700";
const TH_SORTABLE_160 =
  "sticky top-0 z-10 w-[160px] min-w-[160px] max-w-[160px] cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700";
const TH_PLAIN_160 =
  "sticky top-0 z-10 w-[160px] min-w-[160px] max-w-[160px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]";
const TH_PLAIN_180 =
  "sticky top-0 z-10 w-[180px] min-w-[180px] max-w-[180px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]";
const TH_PLAIN_240 =
  "sticky top-0 z-10 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]";

type MiddleColumnId =
  | "status"
  | "author"
  | "automationTags"
  | "triggerEvent"
  | "purpose"
  | "notes"
  | "ghlTags"
  | "ghlForms"
  | "webhooks"
  | "lastEditedAt"
  | "lastRunAt"
  | "lastErrorAt";

interface MiddleColumnDef {
  id: MiddleColumnId;
  /** Header label AND CSV export header. */
  title: string;
  /** Sort key when sortable; null for display-only columns. */
  sortKey: SortKey | null;
  /** The header <th> classes (see the TH_* consts above). */
  thClassName: string;
  /** Custom SyncedColumnMarker tooltip (Last Error); else the marker default. */
  syncTooltip?: string;
  /** Restrict to these platform slugs (GHL Tags / GHL Forms only). */
  platforms?: string[];
  /** CSV cell value. */
  exportValue: (r: AutomationRow) => string;
}

// Default left-to-right order (matches the pre-refactor table exactly).
const MIDDLE_COLUMNS: MiddleColumnDef[] = [
  {
    id: "status",
    title: "Status",
    sortKey: "status",
    thClassName: TH_SORTABLE_AUTO,
    exportValue: (r) => r.status,
  },
  {
    id: "author",
    title: "Author",
    sortKey: "author",
    thClassName: TH_SORTABLE_160,
    exportValue: (r) => r.author ?? "",
  },
  {
    id: "automationTags",
    title: "Automation Tags",
    sortKey: null,
    thClassName: TH_PLAIN_240,
    exportValue: (r) => (r.automationTags ?? []).map((t) => t.value).join(", "),
  },
  {
    id: "triggerEvent",
    title: "Trigger Event",
    sortKey: null,
    thClassName: TH_PLAIN_160,
    exportValue: (r) => r.triggerEvent ?? "",
  },
  {
    id: "purpose",
    title: "Purpose",
    sortKey: null,
    thClassName: TH_PLAIN_240,
    exportValue: (r) => r.purpose ?? "",
  },
  {
    id: "notes",
    title: "Notes",
    sortKey: null,
    thClassName: TH_PLAIN_240,
    exportValue: (r) => r.notes ?? "",
  },
  {
    id: "ghlTags",
    title: "GHL Tags",
    sortKey: null,
    thClassName: TH_PLAIN_180,
    platforms: ["ghl", "ghl-b2b"],
    exportValue: (r) => (r.ghlTags ?? []).map((t) => t.value).join(", "),
  },
  {
    id: "ghlForms",
    title: "GHL Forms",
    sortKey: null,
    thClassName: TH_PLAIN_180,
    platforms: ["ghl", "ghl-b2b"],
    exportValue: (r) => (r.ghlForms ?? []).map((t) => t.value).join(", "),
  },
  {
    id: "webhooks",
    title: "Webhook Links",
    sortKey: null,
    thClassName: TH_PLAIN_240,
    exportValue: (r) => (r.webhooks ?? []).map((w) => w.url).join(", "),
  },
  {
    id: "lastEditedAt",
    title: "Last Edited",
    sortKey: "lastEditedAt",
    thClassName: TH_SORTABLE_AUTO,
    exportValue: (r) => (r.lastEditedAt ? formatDateCell(r.lastEditedAt) : ""),
  },
  {
    id: "lastRunAt",
    title: "Last Runtime",
    sortKey: "lastRunAt",
    thClassName: TH_SORTABLE_AUTO,
    exportValue: (r) => (r.lastRunAt ? formatDateCell(r.lastRunAt) : ""),
  },
  {
    id: "lastErrorAt",
    title: "Last Error",
    sortKey: "lastErrorAt",
    thClassName: TH_SORTABLE_AUTO,
    syncTooltip: "Updated by error tracking.",
    exportValue: (r) => (r.lastErrorAt ? formatDateCell(r.lastErrorAt) : ""),
  },
];

const MIDDLE_DEFAULT_ORDER: MiddleColumnId[] = MIDDLE_COLUMNS.map((c) => c.id);

/** Reconcile a persisted order with the known columns: keep valid ids in their
 *  saved order, drop unknown ones, and append any new columns not yet saved. */
function normalizeColumnOrder(saved: unknown): MiddleColumnId[] {
  if (!Array.isArray(saved)) return MIDDLE_DEFAULT_ORDER;
  const known = new Set<string>(MIDDLE_DEFAULT_ORDER);
  const seen = new Set<MiddleColumnId>();
  const cleaned = saved.filter(
    (id): id is MiddleColumnId =>
      typeof id === "string" && known.has(id) && !seen.has(id as MiddleColumnId) && (seen.add(id as MiddleColumnId), true),
  );
  const missing = MIDDLE_DEFAULT_ORDER.filter((id) => !seen.has(id));
  return [...cleaned, ...missing];
}

/** Escape one CSV field: wrap in double-quotes (doubling internal quotes) when
 *  it contains a comma, quote, or newline. Purpose can contain all three. */
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize rows to a CSV string (CRLF line endings, RFC-4180 style). Name +
 *  Link come first (the frozen identity column), then the middle columns in the
 *  caller's current on-screen order (already platform-filtered), matching what
 *  the table shows and honoring any user reordering. */
function rowsToCsv(
  rows: AutomationRow[],
  orderedMiddle: MiddleColumnDef[],
): string {
  const cols: { header: string; value: (r: AutomationRow) => string }[] = [
    { header: "Name", value: (r) => r.name ?? "" },
    { header: "Link", value: (r) => r.externalUrl ?? "" },
    ...orderedMiddle.map((c) => ({ header: c.title, value: c.exportValue })),
  ];
  const header = cols.map((c) => csvEscape(c.header)).join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(c.value(r))).join(","));
  return [header, ...body].join("\r\n");
}

export function AutomationsTableClient({
  platform,
  label,
  description,
  icon,
  iconColor,
  initialRows,
  authorChoices = [],
  triggerEventChoices = [],
  automationTagChoices = [],
  ghlTagChoices = [],
  ghlFormChoices = [],
  webhookChoices = [],
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
  /** Author options for the single-select Author dropdown (Add/Edit dialog). */
  authorChoices?: ChoiceOption[];
  /** Trigger Event options for its single-select dropdown (Add/Edit dialog). */
  triggerEventChoices?: ChoiceOption[];
  /** Automation Tags options for the multi-select chip picker (Add/Edit dialog). */
  automationTagChoices?: ChoiceOption[];
  /** GHL Tags options for its multi-select picker (Add/Edit dialog, GHL pages). */
  ghlTagChoices?: ChoiceOption[];
  /** GHL Forms options for its multi-select picker (Add/Edit dialog, GHL pages). */
  ghlFormChoices?: ChoiceOption[];
  /** Webhook Links options (URL as value) for the multi-select picker. */
  webhookChoices?: ChoiceOption[];
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
  // Filter menu selection (multi-select), PERSISTED PER PAGE in localStorage so
  // it survives reloads / revisits. The key is per-page (the platform slug), so
  // each of the 5 Per Website pages keeps its OWN saved filter. Value is a flat
  // Set of selected choice ids (ids are globally unique across dimensions).
  // Reading this set to ACTUALLY filter the table rows is still a later step.
  const filterStorageKey = `automations-filter:${platform}`;
  const [filterSelected, setFilterSelected] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(filterStorageKey);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const toggleFilterChoice = (id: string) =>
    setFilterSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // "Clear All Filters" shows a brief spinner before clearing. The clear itself
  // is instant, so we hold this loading state ~500ms purely for visible feedback
  // (see the button below).
  const [clearing, setClearing] = useState(false);
  // Save this page's filter selection whenever it changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        filterStorageKey,
        JSON.stringify([...filterSelected]),
      );
    } catch {
      // ignore storage failures (private mode / quota)
    }
  }, [filterSelected, filterStorageKey]);
  const [editMode, setEditMode] = useState(false);
  // GHL Tags + GHL Forms are platform-gated columns: shown only on the GHL pages
  // (per `visibleOnPlatforms` in the column config). `extraGhlCols` widens the
  // table + the empty-state colSpan by however many of the two are visible.
  const showGhlTags = columnVisibleOnPlatform("ghl_tags", platform);
  const showGhlForms = columnVisibleOnPlatform("ghl_forms", platform);
  const extraGhlCols = (showGhlTags ? 1 : 0) + (showGhlForms ? 1 : 0);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRow | null>(null);
  // The purpose text shown in the read-only "Show purpose" popup (null = closed).
  const [showingPurpose, setShowingPurpose] = useState<string | null>(null);
  // The notes text shown in the read-only "Show notes" popup (null = closed).
  // Mirrors showingPurpose. (The per-row clamp is shared: Notes reuses
  // purposeClamp since both cells share the Name-cell-driven row height.)
  const [showingNotes, setShowingNotes] = useState<string | null>(null);
  // The Webhook Links "related automations" lookup target (null = closed). Set
  // when the gold count in a webhook cell is clicked; drives WebhookRelatedDialog.
  const [webhookLookup, setWebhookLookup] = useState<WebhookLookupTarget | null>(
    null,
  );
  // Adaptive Purpose clamp: how many lines of the Purpose blurb to show per row
  // (keyed by row id, default 2). Taller rows (a long Name that wraps) get more
  // lines so the blurb fills the extra height instead of leaving a gap under a
  // fixed 2-line clamp. Measured from the FIXED-width Name cell's height, which
  // is independent of the Purpose text, so there is no measure→expand feedback
  // loop. See the measuring effect below.
  const [purposeClamp, setPurposeClamp] = useState<Record<string, number>>({});
  const nameCellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  // Automation Tags truncation is COUNT-based (user rule 2026-08-13): 1-4 tags
  // show in full; a row with 5+ tags shortens each chip to 4 letters + "…" to stay
  // compact. Decided inline in the cell (below) from automationTags.length, so no
  // height measurement / hidden copy / state is needed.
  // Fit-to-viewport height for the table's scroll container (shared hook).
  const { ref: scrollRef, style: scrollStyle } = useFitViewportHeight();
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
    // Filter-menu selection resolved to per-dimension id sets (the flat
    // filterSelected set split by which choice list each id belongs to). A
    // dimension with NO selection imposes no constraint. Combining rules
    // (user-set 2026-08-10): AND across dimensions + the search box; WITHIN a
    // dimension it's OR; Automation Tags (multi-valued per row) matches if the
    // row has ANY selected tag. Choice ids deleted in Config are absent from the
    // choice lists, so they simply drop out here.
    const authorSel = new Set(
      authorChoices.filter((c) => filterSelected.has(c.id)).map((c) => c.id),
    );
    const triggerSel = new Set(
      triggerEventChoices
        .filter((c) => filterSelected.has(c.id))
        .map((c) => c.id),
    );
    const tagSel = new Set(
      automationTagChoices
        .filter((c) => filterSelected.has(c.id))
        .map((c) => c.id),
    );
    // Per-dimension "None" filter (a `none:<column>` sentinel in filterSelected):
    // match rows that have NO value in that dimension. OR'd with the dimension's
    // selected values (within-dimension OR). A dimension is only skipped when it
    // has neither selected ids nor its None option.
    const authorNone = filterSelected.has("none:author");
    const triggerNone = filterSelected.has("none:trigger_event");
    const tagNone = filterSelected.has("none:automation_tags");
    const base = rows.filter((r) => {
      if (
        q &&
        !(
          r.name.toLowerCase().includes(q) ||
          (r.externalUrl ?? "").toLowerCase().includes(q)
        )
      )
        return false;
      if (authorSel.size || authorNone) {
        const id = r.authorChoiceId;
        const ok =
          (id != null && authorSel.has(id)) || (authorNone && id == null);
        if (!ok) return false;
      }
      if (triggerSel.size || triggerNone) {
        const id = r.triggerEventChoiceId;
        const ok =
          (id != null && triggerSel.has(id)) || (triggerNone && id == null);
        if (!ok) return false;
      }
      if (tagSel.size || tagNone) {
        const tags = r.automationTags ?? [];
        const ok =
          tags.some((t) => tagSel.has(t.id)) || (tagNone && tags.length === 0);
        if (!ok) return false;
      }
      return true;
    });
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
        case "author": {
          // Alphabetical (case-insensitive) like Name; "None" (unset) ALWAYS
          // sinks to the bottom, regardless of direction, matching the date
          // columns' blanks-last rule.
          const av = a.author?.trim() ?? "";
          const bv = b.author?.trim() ?? "";
          if (!av && !bv) return 0;
          if (!av) return 1;
          if (!bv) return -1;
          return dir * av.localeCompare(bv, undefined, { sensitivity: "base" });
        }
        default:
          return 0;
      }
    });
  }, [
    rows,
    query,
    sortKey,
    sortDir,
    filterSelected,
    authorChoices,
    triggerEventChoices,
    automationTagChoices,
  ]);

  // Recompute the per-row Purpose line count after layout, and whenever the
  // visible rows change (sort/filter/data) or the window resizes. text-xs
  // line-height = 16px; the Name cell's clientHeight includes its py-2 (16px)
  // padding, and floor() guarantees Purpose never grows the row past the Name
  // cell (so it fills the row's height, it doesn't drive it). Min 2 lines.
  useEffect(() => {
    const PURPOSE_LINE_PX = 16; // text-xs line-height (1rem)
    const CELL_PADDING_Y = 16; // py-2 top + bottom
    const measure = () => {
      const next: Record<string, number> = {};
      for (const [id, el] of nameCellRefs.current) {
        const contentH = el.clientHeight - CELL_PADDING_Y;
        next[id] = Math.max(2, Math.floor(contentH / PURPOSE_LINE_PX));
      }
      setPurposeClamp((prev) => {
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
  }, [filtered]);

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
    if (
      !(await confirmDialog({
        title: "Delete automation",
        body: `Delete ${label}? This can't be undone.`,
        confirmLabel: "Delete",
        destructive: true,
      }))
    )
      return;
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
    const csv = rowsToCsv(rows, orderedMiddle);
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

  // Shared props every ColumnHeader needs (the edit-mode header dropdown). Bundled
  // so each header cell only has to declare its own className + sortKey.
  const headerProps = {
    editMode,
    activeSortKey: sortKey,
    sortDir,
    onCycleSort: toggleSort,
  };

  // ── Reorderable MIDDLE columns ─────────────────────────────────────────────
  // The order is user-controlled (Move Column Left/Right in a header's edit-mode
  // dropdown) and persisted PER PAGE in localStorage (same approach as the
  // Filter). Name (frozen, first) and Actions (last) are pinned and excluded.
  const columnOrderKey = `automations:columnOrder:${platform}`;
  const [columnOrder, setColumnOrder] = useState<MiddleColumnId[]>(() => {
    if (typeof window === "undefined") return MIDDLE_DEFAULT_ORDER;
    try {
      const raw = window.localStorage.getItem(columnOrderKey);
      return raw ? normalizeColumnOrder(JSON.parse(raw)) : MIDDLE_DEFAULT_ORDER;
    } catch {
      return MIDDLE_DEFAULT_ORDER;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(columnOrderKey, JSON.stringify(columnOrder));
    } catch {
      // ignore (private mode / storage full)
    }
  }, [columnOrder, columnOrderKey]);

  // The middle columns in the user's order, filtered to those visible on this
  // platform (drops GHL Tags / GHL Forms off the GHL pages). Single source that
  // drives the header, the body cells, AND the CSV export so they stay in sync.
  const orderedMiddle = useMemo(
    () =>
      columnOrder
        .map((id) => MIDDLE_COLUMNS.find((c) => c.id === id))
        .filter((c): c is MiddleColumnDef => !!c)
        .filter((c) => !c.platforms || c.platforms.includes(platform)),
    [columnOrder, platform],
  );

  // Swap a column with its visible neighbor in `dir` and persist. Operates on the
  // VISIBLE order so an off-platform column never causes a dead swap.
  const moveColumn = (id: MiddleColumnId, dir: -1 | 1) => {
    setColumnOrder((prev) => {
      const visible = prev.filter((cid) => {
        const def = MIDDLE_COLUMNS.find((c) => c.id === cid);
        return def && (!def.platforms || def.platforms.includes(platform));
      });
      const vIdx = visible.indexOf(id);
      const targetId = visible[vIdx + dir];
      if (vIdx < 0 || targetId === undefined) return prev;
      const next = [...prev];
      const a = next.indexOf(id);
      const b = next.indexOf(targetId);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  // Reset every column to the default arrangement (persisted via the effect),
  // behind a confirm so an accidental click can't wipe a custom layout. Deferred
  // with setTimeout so the header dropdown finishes closing before the confirm
  // dialog opens (opening it synchronously from a menu item clashes on focus).
  const resetColumnOrder = () => {
    setTimeout(async () => {
      if (
        !(await confirmDialog({
          title: "Reset column order",
          body: "Reset all columns to their default arrangement?",
          confirmLabel: "Reset",
          destructive: true,
        }))
      )
        return;
      setColumnOrder([...MIDDLE_DEFAULT_ORDER]);
    }, 0);
  };

  // Header cell for a middle column: its ColumnHeader (inner marker/label/arrow)
  // plus the reorder handlers (disabled at the edges via undefined).
  const renderMiddleHeader = (col: MiddleColumnDef, vIdx: number) => {
    const inner = col.sortKey ? (
      <span className="inline-flex items-center justify-center gap-1">
        {isSynced(col.sortKey) && (
          <SyncedColumnMarker
            platformLabel={label}
            spinning={refreshing}
            tooltip={col.syncTooltip}
          />
        )}
        {col.title}
        <SortArrow active={sortKey === col.sortKey} dir={sortDir} />
      </span>
    ) : (
      col.title
    );
    return (
      <ColumnHeader
        key={col.id}
        {...headerProps}
        sortKey={col.sortKey}
        className={col.thClassName}
        onMoveLeft={vIdx > 0 ? () => moveColumn(col.id, -1) : undefined}
        onMoveRight={
          vIdx < orderedMiddle.length - 1
            ? () => moveColumn(col.id, 1)
            : undefined
        }
        onResetOrder={resetColumnOrder}
      >
        {inner}
      </ColumnHeader>
    );
  };

  // Body cell for a middle column + a row (the former inline <td> per column,
  // moved here verbatim so behavior is unchanged; only their ORDER is now
  // data-driven).
  const renderMiddleCell = (id: MiddleColumnId, r: AutomationRow): ReactNode => {
    switch (id) {
      case "status":
        return (
          <td key={id} className="px-3 py-2 text-center align-top">
            {/* Status pill (badge): green Active, neutral gray Paused. */}
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                r.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-zinc-100 text-zinc-700",
              )}
            >
              {r.status === "active" ? "Active" : "Paused"}
            </span>
          </td>
        );
      case "author":
        return (
          <td
            key={id}
            className="w-[160px] min-w-[160px] max-w-[160px] px-3 py-2 text-center align-top"
          >
            {r.author ? (
              <ColorBadge
                value={r.author}
                badgeColor={r.authorBadgeColor}
                textColor={r.authorTextColor}
              />
            ) : (
              <span className="text-xs font-medium text-red-600">None</span>
            )}
          </td>
        );
      case "automationTags":
        return (
          <td
            key={id}
            className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-center align-top"
          >
            {r.automationTags && r.automationTags.length > 0 ? (
              // 1-4 tags show in full; in a 5+ tag row, chips whose name is 7+
              // chars shorten to 4 letters + "…" (full name on hover).
              <span className="flex flex-wrap justify-center gap-1">
                {r.automationTags.map((t) => {
                  const truncate =
                    r.automationTags!.length > 4 && t.value.length >= 7;
                  const tagLabel = truncate ? `${t.value.slice(0, 4)}…` : t.value;
                  return (
                    <ColorBadge
                      key={t.id}
                      value={tagLabel}
                      title={truncate ? t.value : undefined}
                      badgeColor={t.badgeColor}
                      textColor={t.textColor}
                    />
                  );
                })}
              </span>
            ) : (
              <span className="text-xs font-medium text-red-600">None</span>
            )}
          </td>
        );
      case "triggerEvent":
        return (
          <td
            key={id}
            className="w-[160px] min-w-[160px] max-w-[160px] px-3 py-2 text-center align-top"
          >
            {r.triggerEvent ? (
              <ColorBadge
                value={r.triggerEvent}
                badgeColor={r.triggerEventBadgeColor}
                textColor={r.triggerEventTextColor}
              />
            ) : (
              <span className="text-xs font-medium text-red-600">None</span>
            )}
          </td>
        );
      case "purpose":
        return (
          <td
            key={id}
            className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left align-top"
          >
            {r.purpose ? (
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
                      style={{ WebkitLineClamp: purposeClamp[r.id] ?? 2 }}
                    >
                      {r.purpose}
                    </button>
                  }
                />
                <TooltipContent className="max-w-xs whitespace-pre-wrap text-left normal-case">
                  {r.purpose}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-xs font-medium text-red-600">None</span>
            )}
          </td>
        );
      case "notes":
        return (
          <td
            key={id}
            className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left align-top"
          >
            {r.notes ? (
              <Tooltip disableHoverablePopup>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled={editMode}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowingNotes(r.notes ?? "");
                      }}
                      className="w-full cursor-pointer line-clamp-2 break-words text-left text-xs text-zinc-700 hover:text-zinc-900 hover:underline disabled:pointer-events-none disabled:cursor-default disabled:no-underline"
                      style={{ WebkitLineClamp: purposeClamp[r.id] ?? 2 }}
                    >
                      {r.notes}
                    </button>
                  }
                />
                <TooltipContent className="max-w-xs whitespace-pre-wrap text-left normal-case">
                  {r.notes}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-xs font-medium text-red-600">None</span>
            )}
          </td>
        );
      case "ghlTags":
        return (
          <td
            key={id}
            className="w-[180px] min-w-[180px] max-w-[180px] px-3 py-2 text-left align-top"
          >
            {r.ghlTags && r.ghlTags.length > 0 ? (
              <div
                className="overflow-hidden"
                style={{ maxHeight: (purposeClamp[r.id] ?? 2) * 16 }}
              >
                {r.ghlTags.map((t, i, arr) => (
                  <div
                    key={t.id}
                    title={t.value}
                    className="truncate text-xs text-zinc-700"
                  >
                    {i === 0 && (
                      <span className="font-medium text-amber-600">
                        ({arr.length}){" "}
                      </span>
                    )}
                    {t.value}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs font-medium text-red-600">None</span>
            )}
          </td>
        );
      case "ghlForms":
        return (
          <td
            key={id}
            className="w-[180px] min-w-[180px] max-w-[180px] px-3 py-2 text-left align-top"
          >
            {r.ghlForms && r.ghlForms.length > 0 ? (
              <div
                className="overflow-hidden"
                style={{ maxHeight: (purposeClamp[r.id] ?? 2) * 16 }}
              >
                {r.ghlForms.map((f, i, arr) => (
                  <div
                    key={f.id}
                    title={f.value}
                    className="truncate text-xs text-zinc-700"
                  >
                    {i === 0 && (
                      <span className="font-medium text-amber-600">
                        ({arr.length}){" "}
                      </span>
                    )}
                    {f.value}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs font-medium text-red-600">None</span>
            )}
          </td>
        );
      case "webhooks":
        return (
          <td
            key={id}
            className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left align-top"
          >
            {r.webhooks && r.webhooks.length > 0 ? (
              <div
                className="overflow-hidden"
                style={{ maxHeight: (purposeClamp[r.id] ?? 2) * 16 }}
              >
                {r.webhooks.map((w, i, arr) => (
                  <button
                    key={w.id}
                    type="button"
                    disabled={editMode}
                    title={w.url}
                    onClick={(e) => {
                      e.stopPropagation();
                      setWebhookLookup({
                        anchor: { id: r.id, name: r.name, platform },
                        webhooks: arr.map((wh) => ({ id: wh.id, url: wh.url })),
                      });
                    }}
                    className="block w-full cursor-pointer truncate text-left text-xs text-blue-600 hover:underline disabled:pointer-events-none disabled:cursor-default disabled:no-underline"
                  >
                    {i === 0 && (
                      <span className="font-medium text-amber-600">
                        ({arr.length}){" "}
                      </span>
                    )}
                    {w.url}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs font-medium text-red-600">None</span>
            )}
          </td>
        );
      case "lastEditedAt":
        return (
          <td key={id} className="px-3 py-2 align-top text-center">
            {r.lastEditedAt ? (
              <span className="text-xs tabular-nums text-zinc-700">
                {formatDateCell(r.lastEditedAt)}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">-</span>
            )}
          </td>
        );
      case "lastRunAt":
        return (
          <td key={id} className="px-3 py-2 align-top text-center">
            {r.lastRunAt ? (
              <span className="text-xs tabular-nums text-zinc-700">
                {formatDateCell(r.lastRunAt)}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">-</span>
            )}
          </td>
        );
      case "lastErrorAt":
        return (
          <td key={id} className="px-3 py-2 align-top text-center">
            {r.lastErrorAt ? (
              <span className="text-xs tabular-nums text-red-600">
                {formatDateCell(r.lastErrorAt)}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">-</span>
            )}
          </td>
        );
      default:
        return null;
    }
  };

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
              Refresh List. Black (default) button, matching Refresh List. Exports
              ALL rows (not the filtered/sorted view); disabled when empty. */}
          <Button
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

          {/* Edit mode toggle. (The "+ New Workflow" add button lives in the
              search row below, to the right of the Filter button.) */}
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Search row: search bar on the LEFT, Filter button on the RIGHT (same
            height). The search bar is full-width (flex-1, no max-width cap) so it
            stretches across the row like the Dropdown Config page's search bar;
            `ml-auto` on the button group keeps the actions pinned to the far right
            (redundant while the search bar fills the row, but harmless). */}
        <div className="flex items-center gap-2">
          {/* Search bar, searches the automation NAME or LINK. */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search automations by name or link…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Right-side actions, pinned right as ONE group via a single ml-auto
              on the wrapper (two separate ml-autos would split the slack and pull
              the buttons apart). "Clear All Filters" (red) shows only when this
              page has an active filter selection; clicking it empties the
              selection, which also unchecks everything, drops the filter, and
              clears this page's saved localStorage entry. */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {filterSelected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                disabled={clearing}
                onClick={() => {
                  setClearing(true);
                  // The clear is instant; hold the spinner briefly so the loading
                  // animation is actually visible, then clear (which unmounts this
                  // button since the selection becomes empty).
                  setTimeout(() => {
                    setFilterSelected(new Set());
                    setClearing(false);
                  }, 500);
                }}
              >
                {clearing ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="mr-2 h-3.5 w-3.5" />
                )}
                Clear All Filters
              </Button>
            )}
            {/* Filter menu (trigger keeps the Export CSV outline look). */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "shrink-0",
              )}
            >
              <Filter className="mr-2 h-3.5 w-3.5" />
              Filter
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-44">
              {/* Each filter DIMENSION is a submenu (fly-out). Its contents are
                  that dimension's configured CHOICES, i.e. the entries from the
                  matching Dropdown Config Page table (Author / Automation Tags /
                  Trigger Event), handed to this component as *Choices props. The
                  three dimensions map to the three config tables the user named.
                  TODO(filter): selecting a choice-value doesn't filter yet
                  (behavior still TBD); the values just list here for now. */}
              {[
                { label: "Author", key: "author", choices: authorChoices },
                {
                  label: "Automation Tags",
                  key: "automation_tags",
                  choices: automationTagChoices,
                },
                {
                  label: "Trigger Event",
                  key: "trigger_event",
                  choices: triggerEventChoices,
                },
              ].map((dim) => (
                <DropdownMenuSub key={dim.label}>
                  {/* This Filter menu is right-aligned, so its submenus fly out
                      to the LEFT. So the sub-trigger's caret points LEFT and sits
                      on the LEFT of the label (user request). We hide the
                      primitive's built-in right caret (`svg:last-child`) and add a
                      left one before the label; scoped here only, the shared
                      DropdownMenuSubTrigger default is untouched. */}
                  <DropdownMenuSubTrigger className="[&>svg:last-child]:hidden">
                    <ChevronLeft className="size-4" />
                    {/* Checkbox reflects whether ANY choice in this dimension —
                        or its "None" option — is selected (summary indicator; the
                        row still opens the submenu on click). Presentational. */}
                    <Checkbox
                      checked={
                        filterSelected.has(`none:${dim.key}`) ||
                        dim.choices.some((c) => filterSelected.has(c.id))
                      }
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                    {dim.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    {/* "None" filter option, kept at the TOP of the list (user
                        request): matches rows that have NO value in this dimension.
                        Rendered as a WHITE pill with RED text, echoing the cells'
                        red "None". Keyed on a `none:<column>` sentinel (not a real
                        choice id), handled specially in the predicate + summary
                        checkbox. */}
                    <DropdownMenuItem
                      closeOnClick={false}
                      onClick={() => toggleFilterChoice(`none:${dim.key}`)}
                    >
                      <Checkbox
                        checked={filterSelected.has(`none:${dim.key}`)}
                        tabIndex={-1}
                        className="pointer-events-none"
                      />
                      <span className="inline-block rounded-md border border-black/10 bg-white px-3 py-0.5 text-xs font-medium text-red-600">
                        None
                      </span>
                    </DropdownMenuItem>
                    {dim.choices.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        closeOnClick={false}
                        onClick={() => toggleFilterChoice(c.id)}
                      >
                        {/* Checkbox (multi-select) + the choice as its configured
                            pill (badge + text colour from its Config Page table);
                            ColorBadge falls back to plain text when a choice has no
                            colour. Presentational checkbox; the item's onClick
                            toggles it, closeOnClick={false} keeps the menu open. */}
                        <Checkbox
                          checked={filterSelected.has(c.id)}
                          tabIndex={-1}
                          className="pointer-events-none"
                        />
                        <ColorBadge
                          value={c.value}
                          badgeColor={c.badgeColor}
                          textColor={c.textColor}
                        />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
            {/* New Workflow (add) button, to the RIGHT of the Filter button.
                ALWAYS shown, independent of Edit mode, so a workflow can be added
                without turning edit mode on. */}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Workflow
            </Button>
          </div>
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
            `min-w-[2250px]` so once columns exceed the card width it overflows
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
          <CardContent
            ref={scrollRef}
            style={scrollStyle}
            className="max-h-[70vh] overflow-auto p-0"
          >
            <table
              className="w-full text-sm"
              style={{ minWidth: 2290 + extraGhlCols * 180 }}
            >
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  {/* Corner cell: pinned to BOTH the top (header) and the left
                      (frozen Name column), so it needs the highest z-index plus
                      both the bottom-edge shadow (header) and the right-edge
                      shadow (frozen column). */}
                  <ColumnHeader
                    {...headerProps}
                    sortKey="name"
                    className="sticky left-0 top-0 z-20 w-[400px] min-w-[400px] max-w-[400px] cursor-pointer select-none bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7,inset_-1px_0_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                    onResetOrder={resetColumnOrder}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isSynced("name") && (
                        <SyncedColumnMarker platformLabel={label} spinning={refreshing} />
                      )}
                      Name
                      <SortArrow active={sortKey === "name"} dir={sortDir} />
                    </span>
                  </ColumnHeader>
                  {/* The reorderable middle columns (Status through Last Error),
                      rendered in the user's saved order. GHL Tags / GHL Forms are
                      filtered out on non-GHL pages by orderedMiddle. */}
                  {orderedMiddle.map((col, i) => renderMiddleHeader(col, i))}
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
                      colSpan={2 + orderedMiddle.length}
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
                      <td
                        ref={(el) => {
                          // Track each Name cell so the effect can measure its
                          // height and size the row's Purpose clamp to match.
                          if (el) nameCellRefs.current.set(r.id, el);
                          else nameCellRefs.current.delete(r.id);
                        }}
                        className="sticky left-0 z-10 w-[400px] min-w-[400px] max-w-[400px] bg-white px-3 py-2 align-top shadow-[inset_-1px_0_0_0_#e4e4e7] group-hover:bg-zinc-50"
                      >
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
                        {/* break-words so a single over-long word (no spaces)
                            breaks onto the next line instead of overflowing the
                            fixed 400px column. Normal multi-word names wrap as
                            usual. */}
                        <div className="font-medium text-zinc-900 break-words">
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
                      {/* The reorderable middle cells (Status through Last Error),
                          rendered in the user's saved order; GHL Tags / GHL Forms
                          are dropped on non-GHL pages by orderedMiddle. Each cell's
                          markup was moved verbatim into renderMiddleCell, so only
                          their ORDER is now data-driven. */}
                      {orderedMiddle.map((col) => renderMiddleCell(col.id, r))}
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
        authorChoices={authorChoices}
        triggerEventChoices={triggerEventChoices}
        automationTagChoices={automationTagChoices}
        ghlTagChoices={ghlTagChoices}
        ghlFormChoices={ghlFormChoices}
        webhookChoices={webhookChoices}
        onCreated={handleCreated}
      />
      {/* Edit */}
      <WorkflowDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        platform={platform}
        existing={editing ?? undefined}
        authorChoices={authorChoices}
        triggerEventChoices={triggerEventChoices}
        automationTagChoices={automationTagChoices}
        ghlTagChoices={ghlTagChoices}
        ghlFormChoices={ghlFormChoices}
        webhookChoices={webhookChoices}
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

      {/* Read-only "Show notes" popup (mirrors the Purpose popup) */}
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

      {/* Webhook Links "related automations" lookup (opened from a cell's gold
          count). Read-only; fetches the cross-platform list on demand. */}
      <WebhookRelatedDialog
        target={webhookLookup}
        onOpenChange={(o) => !o && setWebhookLookup(null)}
      />
    </div>
  );
}
