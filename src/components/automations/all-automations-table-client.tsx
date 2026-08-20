"use client";

// The "Everything Table" — every automation across all 5 websites in ONE
// read-only table. Reached from the Main Page "View All Lists" toolbar button
// (route /automations/all).
//
// It mirrors the Per Website Page table (search + columns + column sort +
// Purpose popup + sticky header / frozen Name / horizontal scroll) but WITHOUT
// the per-platform toolbar (Auto-refresh, Refresh List, Export CSV, Edit mode)
// and WITHOUT edit/delete — those are per-platform and don't translate to a
// mixed table. It ADDS a "Website" column so rows from different platforms are
// distinguishable.
//
// ⚠️ SEPARATE component from AutomationsTableClient ON PURPOSE (that one is
// tightly coupled to a single platform + its toolbar/sync/markers). The two are
// allowed to diverge: when a Per Website Page column/feature is added, ASK the
// dev whether it should also be added here.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useFitViewportHeight } from "@/lib/automations/use-fit-viewport-height";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  ExternalLink,
  Filter,
  ChevronDown,
  ChevronLeft,
  Columns3,
  Eye,
  Pencil,
  RotateCcw,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/confirm";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { ColorBadge } from "./color-badge";
import {
  WebhookRelatedDialog,
  type WebhookLookupTarget,
} from "./webhook-related-dialog";
import { useColumnDrag, DRAG_COL_ATTR } from "./use-column-drag";
import {
  SharedWebhookIcon,
  compareWebhookShared,
  webhookLineTitle,
} from "./shared-webhook-icon";
import {
  columnVisibleOnPlatform,
  compareTriage,
  type ChoiceOption,
} from "@/lib/automations/dropdown-config";
import type { AutomationRow } from "./automations-table-client";

/** A combined-table row: the per-website row shape + which platform it's from. */
export type AllAutomationRow = AutomationRow & { platform: string };

/** platform slug -> site display bits (label + icon), for the Website column. */
const SITE_BY_SLUG = new Map(AUTOMATION_SITES.map((s) => [s.slug, s] as const));

/** Display label for a platform slug (falls back to the raw slug). */
function websiteLabelFor(slug: string): string {
  return SITE_BY_SLUG.get(slug)?.label ?? slug;
}

type SortKey =
  | "name"
  | "website"
  | "status"
  | "lastEditedAt"
  | "lastRunAt"
  | "lastErrorAt"
  | "author"
  | "webhooks"
  | "triage";


/** MM-DD-YYYY, or "-" when empty/invalid. Same as the per-website table. */
function formatDateCell(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

/** Same sort indicator as the per-website table (active amber ▲/▼, else a
 *  static black double-triangle hint), fixed-width so headers don't shift. */
function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (active) {
    return (
      <span className="inline-block w-3 text-center text-[10px] text-amber-600">
        {dir === "asc" ? "▲" : "▼"}
      </span>
    );
  }
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

/** The Website cell: brand logo (tinted SVG via CSS mask, or plain image) +
 *  label. Icon sized to the label text. */
function WebsiteBadge({ slug }: { slug: string }) {
  const site = SITE_BY_SLUG.get(slug);
  if (!site) return <span className="text-xs text-zinc-500">{slug}</span>;
  return (
    <span className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-700">
      {site.iconColor ? (
        <span
          aria-hidden
          className="h-4 w-4 shrink-0"
          style={{
            backgroundColor: site.iconColor,
            maskImage: `url(${site.icon})`,
            WebkitMaskImage: `url(${site.icon})`,
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
        <img src={site.icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
      )}
      {site.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The MIDDLE columns (everything after the frozen Name column). ONE source of
// truth driving the header, the body cell, the Columns show/hide control, and
// the table min-width. Name is pinned first and is NOT in this list.
//
// This replaced a hardcoded 14-column table plus a parallel list of 1-based
// nth-child POSITIONS used to hide columns via a scoped <style> block. That
// worked only while the positions were fixed, and it cost real maintenance:
// inserting Evaluation at position 7 meant hand-shifting every later index and
// the base min-width (and the empty-state colSpan was missed, left at 14 for a
// 15-column table). Hiding is now per-cell, so positions are gone entirely and
// adding a column is a ONE-PLACE edit here.
// ---------------------------------------------------------------------------

// Shared header <th> classes. Sortable variants carry the cursor/hover
// affordance; plain ones do not. AUTO = no fixed width (browser sizes it).
const ALL_TH_S_AUTO =
  "sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700";
const ALL_TH_S_160 =
  "sticky top-0 z-10 w-[160px] min-w-[160px] max-w-[160px] cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700";
const ALL_TH_S_240 =
  "sticky top-0 z-10 w-[240px] min-w-[240px] max-w-[240px] cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700";
const ALL_TH_P_160 =
  "sticky top-0 z-10 w-[160px] min-w-[160px] max-w-[160px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]";
const ALL_TH_P_180 =
  "sticky top-0 z-10 w-[180px] min-w-[180px] max-w-[180px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]";
const ALL_TH_P_240 =
  "sticky top-0 z-10 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]";

type AllColumnId =
  | "website"
  | "status"
  | "author"
  | "automationTags"
  | "triggerEvent"
  | "triage"
  | "purpose"
  | "notes"
  | "ghlTags"
  | "ghlForms"
  | "webhooks"
  | "lastEditedAt"
  | "lastRunAt"
  | "lastErrorAt";

interface AllColumnDef {
  id: AllColumnId;
  /** Header label AND the label in the Columns show/hide checklist. */
  title: string;
  /** Sort key when sortable; null for the display-only columns. */
  sortKey: SortKey | null;
  thClassName: string;
  /** Approximate rendered width, summed into the table min-width so the table
   *  shrinks when a column is hidden (the AUTO-width ones are estimates). */
  width: number;
}

const ALL_HIDDEN_KEY = "automations:all:hiddenColumns";
const ALL_ORDER_KEY = "automations:all:columnOrder";

const ALL_COLUMNS: AllColumnDef[] = [
  { id: "website", title: "Website", sortKey: "website", thClassName: ALL_TH_S_AUTO, width: 120 },
  { id: "status", title: "Status", sortKey: "status", thClassName: ALL_TH_S_AUTO, width: 110 },
  { id: "author", title: "Author", sortKey: "author", thClassName: ALL_TH_S_160, width: 160 },
  { id: "automationTags", title: "Automation Tags", sortKey: null, thClassName: ALL_TH_P_240, width: 240 },
  { id: "triggerEvent", title: "Trigger Event", sortKey: null, thClassName: ALL_TH_P_160, width: 160 },
  { id: "triage", title: "Evaluation", sortKey: "triage", thClassName: ALL_TH_S_160, width: 160 },
  { id: "purpose", title: "Purpose", sortKey: null, thClassName: ALL_TH_P_240, width: 240 },
  { id: "notes", title: "Notes", sortKey: null, thClassName: ALL_TH_P_240, width: 240 },
  { id: "ghlTags", title: "GHL Tags", sortKey: null, thClassName: ALL_TH_P_180, width: 180 },
  { id: "ghlForms", title: "GHL Forms", sortKey: null, thClassName: ALL_TH_P_180, width: 180 },
  { id: "webhooks", title: "Webhook Links", sortKey: "webhooks", thClassName: ALL_TH_S_240, width: 240 },
  { id: "lastEditedAt", title: "Last Edited", sortKey: "lastEditedAt", thClassName: ALL_TH_S_AUTO, width: 136 },
  { id: "lastRunAt", title: "Last Runtime", sortKey: "lastRunAt", thClassName: ALL_TH_S_AUTO, width: 136 },
  { id: "lastErrorAt", title: "Last Error", sortKey: "lastErrorAt", thClassName: ALL_TH_S_AUTO, width: 136 },
];

/** The frozen Name column's fixed width, added on top of the visible middle
 *  columns' widths to get the table min-width. */
const ALL_NAME_WIDTH = 400;

const ALL_DEFAULT_ORDER: AllColumnId[] = ALL_COLUMNS.map((c) => c.id);

/** Reconcile a persisted order with the known columns: keep valid ids in their
 *  saved order, drop unknown ones, and append any column added since the order
 *  was saved. So a new column shows up (at the end) instead of vanishing. */
function normalizeAllOrder(saved: unknown): AllColumnId[] {
  const valid = new Set<string>(ALL_DEFAULT_ORDER);
  const seen = new Set<string>();
  const out: AllColumnId[] = [];
  for (const id of Array.isArray(saved) ? saved : []) {
    if (typeof id === "string" && valid.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id as AllColumnId);
    }
  }
  for (const id of ALL_DEFAULT_ORDER) if (!seen.has(id)) out.push(id);
  return out;
}




export function AllAutomationsTableClient({
  rows,
  authorChoices = [],
  triggerEventChoices = [],
  triageChoices = [],

  automationTagChoices = [],
}: {
  rows: AllAutomationRow[];
  /** Filter-menu options (the Dropdown Config Page choices). Same three
   *  dimensions as the Per Website filter; this table mirrors that feature. */
  authorChoices?: ChoiceOption[];
  triggerEventChoices?: ChoiceOption[];
  triageChoices?: ChoiceOption[];

  automationTagChoices?: ChoiceOption[];
}) {
  const [query, setQuery] = useState("");
  // Filter menu selection (multi-select), mirrors the Per Website table and is
  // PERSISTED in localStorage under a FIXED key ("all") so this page keeps its
  // own saved filter across reloads, separate from the 5 Per Website pages.
  // A flat Set of selected choice ids (ids are globally unique). Reading it to
  // actually filter the table is a later step.
  const filterStorageKey = "automations-filter:all";
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
  // Save this page's filter selection whenever it changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        filterStorageKey,
        JSON.stringify([...filterSelected]),
      );
    } catch {
      // ignore storage failures
    }
  }, [filterSelected, filterStorageKey]);

  // Columns hidden via the "Columns" control, persisted for THIS page. A hidden
  // id is simply filtered out of ALL_COLUMNS (see visibleColumns), so its header
  // and cells are never rendered at all.
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(ALL_HIDDEN_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      const known = new Set<string>(ALL_COLUMNS.map((c) => c.id));

      return new Set(
        (Array.isArray(saved) ? saved : []).filter(
          (id): id is string => typeof id === "string" && known.has(id),
        ),
      );
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(ALL_HIDDEN_KEY, JSON.stringify([...hiddenColumns]));
    } catch {
      // ignore storage failures
    }
  }, [hiddenColumns]);
  const toggleColumn = (id: string) =>
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const showAllColumns = () => setHiddenColumns(new Set());
  const hiddenCount = hiddenColumns.size;

  // ── Edit mode ──────────────────────────────────────────────────────────────
  // Introduced here purely to gate column dragging, mirroring the Per Website
  // page (where it also enables row-click-to-edit). The other edit-mode features
  // are deliberately NOT wired up on this page yet — this page is read-only for
  // now, so the toggle currently means "let me rearrange columns".
  const [editMode, setEditMode] = useState(false);

  // ── Column order ───────────────────────────────────────────────────────────
  // User-controlled by dragging a header (edit mode only), persisted for THIS
  // page. Name is pinned first and is not part of the order.
  const [columnOrder, setColumnOrder] = useState<AllColumnId[]>(() => {
    if (typeof window === "undefined") return ALL_DEFAULT_ORDER;
    try {
      const raw = localStorage.getItem(ALL_ORDER_KEY);
      return normalizeAllOrder(raw ? JSON.parse(raw) : null);
    } catch {
      return ALL_DEFAULT_ORDER;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(ALL_ORDER_KEY, JSON.stringify(columnOrder));
    } catch {
      // ignore storage failures
    }
  }, [columnOrder]);

  // The middle columns actually rendered: in the user's saved order, minus
  // whatever the Columns control has hidden. Drives the header, the body cells,
  // the empty-state colSpan, and the table min-width.
  const orderedColumns = columnOrder
    .map((id) => ALL_COLUMNS.find((c) => c.id === id))
    .filter((c): c is AllColumnDef => !!c);
  const visibleColumns = orderedColumns.filter((c) => !hiddenColumns.has(c.id));

  // Drop a column at an ARBITRARY visible position. `to` is an insertion GAP in
  // the VISIBLE list, so it is expressed relative to the visible ANCHOR and then
  // applied to the full order (which also holds hidden ids), keeping hidden
  // columns roughly where they were.
  const moveColumnTo = (id: AllColumnId, to: number) => {
    setColumnOrder((prev) => {
      const visible = prev.filter((cid) => !hiddenColumns.has(cid));
      const from = visible.indexOf(id);
      if (from < 0) return prev;
      // The gaps either side of the dragged column are where it already is.
      if (to === from || to === from + 1) return prev;
      const anchorId = to < visible.length ? visible[to] : null;
      const next = prev.filter((cid) => cid !== id);
      if (anchorId === null) {
        const last = visible[visible.length - 1];
        const anchor = last === id ? visible[visible.length - 2] : last;
        const at = anchor ? next.indexOf(anchor) + 1 : next.length;
        next.splice(at, 0, id);
      } else {
        next.splice(next.indexOf(anchorId), 0, id);
      }
      return next;
    });
  };

  // Reset the arrangement. Lives in the Columns dropdown rather than a header
  // menu, because this page has no header menus yet (see the Edit mode note);
  // it can move into one if those land. Behind a confirm so a stray click can't
  // wipe a custom layout, deferred so the menu finishes closing first.
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
      setColumnOrder([...ALL_DEFAULT_ORDER]);
    }, 0);
  };

  const isDefaultOrder = columnOrder.every(
    (id, i) => id === ALL_DEFAULT_ORDER[i],
  );


  // Summed from the VISIBLE columns (plus the frozen Name column) rather than
  // subtracted from a hardcoded base, so the number cannot drift out of step
  // when a column is added or removed.
  const tableMinWidth =
    ALL_NAME_WIDTH + visibleColumns.reduce((sum, c) => sum + c.width, 0);


  // The purpose text shown in the read-only popup (null = closed).
  const [showingPurpose, setShowingPurpose] = useState<string | null>(null);
  // The notes text shown in the read-only "Show notes" popup (mirrors Purpose).
  const [showingNotes, setShowingNotes] = useState<string | null>(null);
  // The Webhook Links "related automations" lookup target (null = closed).
  const [webhookLookup, setWebhookLookup] = useState<WebhookLookupTarget | null>(
    null,
  );
  // Adaptive Purpose clamp (see the per-website AutomationsTableClient for the
  // full rationale): line count per row, sized to the fixed-width Name cell so
  // taller rows fill their height instead of leaving a 2-line gap.
  const [purposeClamp, setPurposeClamp] = useState<Record<string, number>>({});
  const nameCellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  // Automation Tags truncation is COUNT-based (user rule 2026-08-13, same as the
  // Per Website table): 1-4 tags show full; 5+ tags shorten each chip to 4 letters
  // + "…". Decided inline in the cell from automationTags.length — no measurement.
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Search matches NAME or LINK (same as the per-website table); the result is
  // then sorted by the active column. All client-side over the loaded rows.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Filter-menu selection → per-dimension id sets (mirrors the Per Website
    // table). A dimension with no selection imposes no constraint. AND across
    // dimensions + search; OR within a dimension; Automation Tags matches on ANY
    // selected tag. Ids deleted in Config drop out (absent from the choice lists).
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
    // Per-dimension "None" filter (a `none:<column>` sentinel): match rows with
    // NO value in that dimension, OR'd with the dimension's selected values.
    const authorNone = filterSelected.has("none:author");
    const triggerNone = filterSelected.has("none:trigger_event");
    const triageSel = new Set(
      triageChoices.filter((c) => filterSelected.has(c.id)).map((c) => c.id),
    );
    // "None" here means NOT YET TRIAGED (null FK), not the "Unknown" choice.
    const triageNone = filterSelected.has("none:triage");

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
      if (triageSel.size || triageNone) {
        const id = r.triageChoiceId;
        const ok =
          (id != null && triageSel.has(id)) || (triageNone && id == null);
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
        case "website":
          return (
            dir *
            websiteLabelFor(a.platform).localeCompare(
              websiteLabelFor(b.platform),
              undefined,
              { sensitivity: "base" },
            )
          );
        case "status": {
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
        case "webhooks":
          // Grouping toggle like Status: asc puts rows with a SHARED webhook
          // first, then rows with webhooks but none shared; rows with NO webhooks
          // always sink to the bottom in BOTH directions. Same comparator the Per
          // Website table uses, so the two pages cannot drift.
          return compareWebhookShared(a, b, dir);
        case "triage":
          // Lifecycle order (see TRIAGE_ORDER), untriaged last in both directions.
          // Same shared comparator the Per Website table uses.
          return compareTriage(a, b, dir);
        case "author": {
          // Alphabetical (case-insensitive); "None" (unset) ALWAYS sinks to the
          // bottom, regardless of direction. Same rule as the per-website table.
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
    triageChoices,

    automationTagChoices,
  ]);

  // Size each row's Purpose clamp to its Name cell height (text-xs line = 16px;
  // Name cell clientHeight includes py-2 = 16px). Min 2 lines. Re-runs on
  // sort/filter/data changes and window resize.
  useEffect(() => {
    const PURPOSE_LINE_PX = 16;
    const CELL_PADDING_Y = 16;
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


  const ariaSort = (key: SortKey) =>
    sortKey === key
      ? sortDir === "asc"
        ? "ascending"
        : "descending"
      : "none";

  // Fit-to-viewport height for the table's scroll container (shared hook).
  const { ref: scrollRef, style: scrollStyle } = useFitViewportHeight();

  // Drag-to-reorder, gated on Edit mode below. Declared AFTER scrollRef because
  // the hook needs it for edge auto-scroll.
  const { tableRef, dragId, headerHandlers, dropEdgeFor } =
    useColumnDrag<AllColumnId>({ scrollRef, onCommit: moveColumnTo });


  // ── Header + cell renderers ────────────────────────────────────────────────
  // Driven by ALL_COLUMNS, so the header row, the body row, the Columns control,
  // the colSpan and the min-width all agree by construction. Every cell's markup
  // below was moved VERBATIM from the hardcoded table, so only their ORDER and
  // presence changed, not their rendering.
  const renderAllHeader = (col: AllColumnDef, vIdx: number) => {
    const key = col.sortKey;
    // Off edit mode the header behaves exactly as it always did: a plain click
    // toggles the sort (or does nothing on the display-only columns), and there
    // is no gesture handling at all.
    if (!editMode) {
      return key ? (
        <th
          key={col.id}
          onClick={() => toggleSort(key)}
          aria-sort={ariaSort(key)}
          className={col.thClassName}
        >
          <span className="inline-flex items-center justify-center gap-1">
            {col.title}
            <SortArrow active={sortKey === key} dir={sortDir} />
          </span>
        </th>
      ) : (
        <th key={col.id} className={col.thClassName}>
          {col.title}
        </th>
      );
    }
    // Edit mode: the cell becomes a drag handle. A plain click still sorts (the
    // hook tells the two apart by a 5px threshold), so sorting is not lost while
    // rearranging. Unlike the Per Website table there is no header menu here, so
    // no controlled-menu handling is needed — the click just sorts.
    const dropEdge = dropEdgeFor(vIdx, visibleColumns.length);
    return (
      <th
        key={col.id}
        {...{ [DRAG_COL_ATTR]: col.id }}
        aria-sort={key ? ariaSort(key) : undefined}
        className={cn(
          col.thClassName,
          "cursor-grab select-none touch-none",
          dragId === col.id && "opacity-40",
          // Insertion line as an INSET box-shadow on the cell edge, so it scrolls
          // with the table and needs no absolute positioning. Listed together
          // with the header's own bottom-border shadow, since a second
          // box-shadow would otherwise replace it.
          dropEdge === "left" &&
            "shadow-[inset_2px_0_0_0_#2563eb,inset_0_-1px_0_0_#e4e4e7]",
          dropEdge === "right" &&
            "shadow-[inset_-2px_0_0_0_#2563eb,inset_0_-1px_0_0_#e4e4e7]",
        )}
        {...headerHandlers(col.id, () => {
          if (key) toggleSort(key);
        })}
      >
        <span className="inline-flex items-center justify-center gap-1">
          {col.title}
          {key && <SortArrow active={sortKey === key} dir={sortDir} />}
        </span>
      </th>
    );
  };


  const renderAllCell = (id: AllColumnId, r: AllAutomationRow) => {
    switch (id) {
      case "website":
        return (
          <td key={id} className="px-3 py-2 text-center align-top">
            {/* Clicking the website entry opens that platform's Per Website Page. */}
            <Link
              href={`/automations/${r.platform}`}
              title={`Open the ${websiteLabelFor(r.platform)} page`}
              className="inline-flex rounded hover:underline"
            >
              <WebsiteBadge slug={r.platform} />
            </Link>
          </td>
        );
      case "status":
        return (
          <td key={id} className="px-3 py-2 text-center align-top">
            {/* Status pill (badge): green for Active, neutral gray for Paused.
                Matches the Per Website table + the house badge convention. */}
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
        // The selected option as a coloured pill (badge + text colours; plain
        // text if none), or red "None" when unset (mirrors Per Website).
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
        // The selected tags as wrapping coloured chips, red "None" when empty.
        return (
          <td
            key={id}
            className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-center align-top"
          >
            {r.automationTags && r.automationTags.length > 0 ? (
              // 1-4 tags show in full. In a 5+ tag row, only chips whose name is
              // 7+ chars shorten to 4 letters + an ellipsis (full name on hover);
              // shorter tags stay full. Count-based.
              <span className="flex flex-wrap justify-center gap-1">
                {r.automationTags.map((t) => {
                  const truncate =
                    r.automationTags!.length > 4 && t.value.length >= 7;
                  const label = truncate ? `${t.value.slice(0, 4)}…` : t.value;
                  return (
                    <ColorBadge
                      key={t.id}
                      value={label}
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
      case "triage":
        // Untriaged renders a muted "-", NOT the red "None" the other manual
        // columns use: untriaged is a normal starting state, not a missing value.
        return (
          <td
            key={id}
            className="w-[160px] min-w-[160px] max-w-[160px] px-3 py-2 text-center align-top"
          >
            {r.triage ? (
              <ColorBadge
                value={r.triage}
                badgeColor={r.triageBadgeColor}
                textColor={r.triageTextColor}
              />
            ) : (
              <span className="text-xs text-zinc-400">-</span>
            )}
          </td>
        );
      case "purpose":
        return (
          <td
            key={id}
            className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left align-top"
          >
            {/* Purpose: a preview that fills the FIXED-WIDTH column (locked to
                240px on th + td). Line count is ADAPTIVE: line-clamp-2 is the
                2-line minimum, the WebkitLineClamp inline style overrides it per
                row with however many lines fit the (Name-driven) row height (see
                the measuring effect). Click opens the read-only popup, hover
                shows a tooltip with the full text. Red "None" when empty.
                ⚠️ DO NOT add `block` to the button: Tailwind v4 emits
                .block{display:block} AFTER .line-clamp-2{display:-webkit-box},
                so block overrides the -webkit-box that line-clamp needs and the
                clamp silently stops working. */}
            {r.purpose ? (
              <Tooltip disableHoverablePopup>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setShowingPurpose(r.purpose ?? "")}
                      className="w-full cursor-pointer line-clamp-2 break-words text-left text-xs text-zinc-700 hover:text-zinc-900 hover:underline"
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
        // Mirrors the Purpose cell (reuses purposeClamp for the row-height clamp).
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
                      onClick={() => setShowingNotes(r.notes ?? "")}
                      className="w-full cursor-pointer line-clamp-2 break-words text-left text-xs text-zinc-700 hover:text-zinc-900 hover:underline"
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
        // Plain-text lines (like Webhook Links), populated only for GHL / GHL b2b
        // rows. Non-GHL rows show a muted "-" (the column does not apply).
        return (
          <td
            key={id}
            className="w-[180px] min-w-[180px] max-w-[180px] px-3 py-2 text-left align-top"
          >
            {!columnVisibleOnPlatform("ghl_tags", r.platform) ? (
              <span className="text-xs text-zinc-400">-</span>
            ) : r.ghlTags && r.ghlTags.length > 0 ? (
              <div
                className="overflow-hidden"
                // Cap the item list to the SAME height as the Purpose/Notes clamp
                // (purposeClamp lines x 16px), so a row with many items shows only
                // the lines that fit and never stretches the row taller than the
                // Name-cell-driven height. Items beyond that are clipped (each
                // item is a 16px text-xs line).
                style={{ maxHeight: (purposeClamp[r.id] ?? 2) * 16 }}
              >
                {r.ghlTags.map((t, i, arr) => (
                  <div
                    key={t.id}
                    title={t.value}
                    className="truncate text-xs text-zinc-700"
                  >
                    {/* Gold "(N)" total-selected count on the first line (the
                        cell clips the rest). */}
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
            {!columnVisibleOnPlatform("ghl_forms", r.platform) ? (
              <span className="text-xs text-zinc-400">-</span>
            ) : r.ghlForms && r.ghlForms.length > 0 ? (
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
        // One truncated line per selected webhook (hover title shows the full URL
        // plus the sharing count); red "None" when empty.
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
                {/* Every webhook line opens the "related automations" lookup (not
                    just the gold count), so the whole cell is a click target. */}
                {r.webhooks.map((w, i, arr) => (
                  <button
                    key={w.id}
                    type="button"
                    title={webhookLineTitle(w)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setWebhookLookup({
                        anchor: {
                          id: r.id,
                          name: r.name,
                          platform: r.platform,
                        },
                        webhooks: arr.map((wh) => ({
                          id: wh.id,
                          url: wh.url,
                        })),
                      });
                    }}
                    className="block w-full cursor-pointer truncate text-left text-xs text-blue-600 hover:underline"
                  >
                    {i === 0 && (
                      <span className="font-medium text-amber-600">
                        ({arr.length}){" "}
                      </span>
                    )}
                    <SharedWebhookIcon sharedWith={w.sharedWith} />
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
      case "lastRunAt":
        return (
          <td key={id} className="px-3 py-2 align-top text-center">
            {r[id] ? (
              <span className="text-xs tabular-nums text-zinc-700">
                {formatDateCell(r[id])}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">-</span>
            )}
          </td>
        );
      case "lastErrorAt":
        return (
          <td key={id} className="px-3 py-2 align-top text-center">
            {/* Last Error: red MM-DD-YYYY, same as the per-website table; "-"
                when none. */}
            {r.lastErrorAt ? (
              <span className="text-xs tabular-nums text-red-600">
                {formatDateCell(r.lastErrorAt)}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">-</span>
            )}
          </td>
        );
    }
  };


  return (
    <div className="space-y-3">
      {/* Search row (mirrors the Per Website table): search bar LEFT, Filter
          button pinned far-right (ml-auto). Search bar is full-width (flex-1, no
          max-width cap) to match the Per Website + Dropdown Config search bars. */}
      <div className="flex items-center gap-2">
        {/* Search bar, matches NAME or LINK (same as the per-website table). */}
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search automations by name or link…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Right-side actions, pinned right as ONE group (single ml-auto on the
            wrapper). "Clear All Filters" now lives at the bottom of the Filter
            menu (mirror of the Per Website filter). */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Columns show/hide control (mirrors the Per Website page). Hides
              columns by position via a scoped <style>; the hidden set persists
              for this page. Name is always shown. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
            )}
          >
            <Columns3 className="mr-2 h-3.5 w-3.5" />
            Columns
            {hiddenCount > 0 && (
              <span className="ml-1 rounded-full bg-zinc-200 px-1.5 text-[10px] font-medium text-zinc-700">
                {hiddenCount}
              </span>
            )}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            {ALL_COLUMNS.map((col) => (

              <DropdownMenuItem
                key={col.id}
                closeOnClick={false}
                onClick={() => toggleColumn(col.id)}
              >
                <Checkbox
                  checked={!hiddenColumns.has(col.id)}
                  tabIndex={-1}
                  className="pointer-events-none"
                />
                {col.title}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={hiddenCount === 0}
              onClick={showAllColumns}
            >
              <Eye />
              Show all columns
            </DropdownMenuItem>
            {/* Reset the drag-reordered arrangement. Both tables keep this in the
                Columns dropdown (the Per Website copy moved here from its header
                menu 2026-08-20), so the two match. Greyed when already default,
                mirroring "Show all columns" above. */}
            <DropdownMenuItem
              disabled={isDefaultOrder}
              onClick={resetColumnOrder}
            >
              <RotateCcw />
              Reset column order
            </DropdownMenuItem>


          </DropdownMenuContent>
        </DropdownMenu>
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
            {filterSelected.size > 0 && (
              <span className="ml-1 rounded-full bg-zinc-200 px-1.5 text-[10px] font-medium text-zinc-700">
                {filterSelected.size}
              </span>
            )}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
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
              { label: "Evaluation", key: "triage", choices: triageChoices },

            ].map((dim) => (

              <DropdownMenuSub key={dim.label}>
                <DropdownMenuSubTrigger className="[&>svg:last-child]:hidden">
                  <ChevronLeft className="size-4" />
                  {/* Checkbox reflects whether ANY choice in this dimension — or
                      its "None" option — is selected. Presentational. */}
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
                {/* side="left": the Filter menu is right-aligned (near the screen
                    edge), so its submenus must open LEFT (matching the
                    left-pointing caret) or they get cut off at the right edge. */}
                <DropdownMenuSubContent
                  side="left"
                  className="max-h-72 overflow-y-auto"
                >
                  {/* "None" filter option kept at the TOP (user request): matches
                      rows with NO value in this dimension. White pill, red text.
                      `none:<column>` sentinel. */}
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
                          pill; plain text when no colour is set. */}
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
            {/* Clear All Filters at the bottom, greyed out when nothing is
                selected (mirrors the Per Website filter + the Columns menu). */}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={filterSelected.size === 0}
              onClick={() => setFilterSelected(new Set())}
            >
              Clear All Filters
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

          {/* Edit mode toggle, matching the Per Website page. On THIS page it
              currently gates one thing: dragging a column header to reorder.
              The other edit-mode features (row-click-to-edit, delete, the header
              menus) are not wired up here yet. */}
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode
            <Switch checked={editMode} onCheckedChange={setEditMode} />
          </div>
        </div>
      </div>

      <TooltipProvider delay={300}>
        <Card>
          <CardContent
            ref={scrollRef}
            style={scrollStyle}
            className="max-h-[70vh] overflow-auto p-0"
          >
            {/* Same shell as the per-website table: bounded scroll, sticky
                header (Option B), frozen Name column, horizontal scroll once the
                columns exceed the card width. */}
            <table
              ref={tableRef}
              className="w-full text-sm"
              style={{ minWidth: tableMinWidth }}
            >
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  {/* Corner cell: frozen Name column, sticky on both axes. */}
                  <th
                    onClick={() => toggleSort("name")}
                    aria-sort={ariaSort("name")}
                    className="sticky left-0 top-0 z-20 w-[400px] min-w-[400px] max-w-[400px] cursor-pointer select-none bg-zinc-50 px-3 py-2 text-left shadow-[inset_0_-1px_0_0_#e4e4e7,inset_-1px_0_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center gap-1">
                      Name
                      <SortArrow active={sortKey === "name"} dir={sortDir} />
                    </span>
                  </th>
                  {/* The middle columns, in ALL_COLUMNS order, minus any hidden
                      by the Columns control. */}
                  {visibleColumns.map((col, i) => renderAllHeader(col, i))}

                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + visibleColumns.length}
                      className="px-3 py-16 text-center text-sm text-zinc-500"
                    >
                      {rows.length === 0
                        ? "No automations yet."
                        : "No automations match your search."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="group border-t hover:bg-zinc-50">
                      <td
                        ref={(el) => {
                          if (el) nameCellRefs.current.set(r.id, el);
                          else nameCellRefs.current.delete(r.id);
                        }}
                        className="sticky left-0 z-10 w-[400px] min-w-[400px] max-w-[400px] bg-white px-3 py-2 align-top shadow-[inset_-1px_0_0_0_#e4e4e7] group-hover:bg-zinc-50"
                      >
                        {/* break-words so a single over-long word (no spaces)
                            breaks onto the next line instead of overflowing the
                            fixed 400px column. */}
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
                      {/* The middle cells, in ALL_COLUMNS order, minus any
                          hidden by the Columns control. Each cell keeps the
                          markup it had when these were hardcoded; only their
                          ORDER and presence are data-driven now. */}
                      {visibleColumns.map((col) => renderAllCell(col.id, r))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Read-only "Show purpose" popup (same as the per-website table). */}
      <Dialog
        open={showingPurpose !== null}
        onOpenChange={(o) => !o && setShowingPurpose(null)}
      >
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Purpose</DialogTitle>
          </DialogHeader>
          <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-sm text-zinc-700">
            {showingPurpose}
          </p>
        </DialogContent>
      </Dialog>

      {/* Read-only "Show notes" popup (mirrors the Purpose popup). */}
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
