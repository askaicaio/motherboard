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
import {
  Search,
  ExternalLink,
  Filter,
  ChevronDown,
  ChevronLeft,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { ColorBadge } from "./color-badge";
import {
  WebhookRelatedDialog,
  type WebhookLookupTarget,
} from "./webhook-related-dialog";
import {
  SharedWebhookIcon,
  compareWebhookShared,
  webhookLineTitle,
} from "./shared-webhook-icon";
import {
  columnVisibleOnPlatform,
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
  | "webhooks";

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

// The View All Lists table renders 14 FIXED columns (hardcoded). This drives the
// "Columns" show/hide control: each hideable column carries its 1-based POSITION
// in the row (used by a scoped nth-child <style> to hide it) + an approximate
// width (subtracted from the table min-width so it shrinks when hidden). Name
// (position 1, frozen) is always shown and is not listed here.
const ALL_HIDDEN_KEY = "automations:all:hiddenColumns";
const ALL_HIDEABLE_COLUMNS: {
  id: string;
  label: string;
  index: number;
  width: number;
}[] = [
  { id: "website", label: "Website", index: 2, width: 120 },
  { id: "status", label: "Status", index: 3, width: 110 },
  { id: "author", label: "Author", index: 4, width: 160 },
  { id: "automationTags", label: "Automation Tags", index: 5, width: 240 },
  { id: "triggerEvent", label: "Trigger Event", index: 6, width: 160 },
  { id: "purpose", label: "Purpose", index: 7, width: 240 },
  { id: "notes", label: "Notes", index: 8, width: 240 },
  { id: "ghlTags", label: "GHL Tags", index: 9, width: 180 },
  { id: "ghlForms", label: "GHL Forms", index: 10, width: 180 },
  { id: "webhooks", label: "Webhook Links", index: 11, width: 240 },
  { id: "lastEditedAt", label: "Last Edited", index: 12, width: 136 },
  { id: "lastRunAt", label: "Last Runtime", index: 13, width: 136 },
  { id: "lastErrorAt", label: "Last Error", index: 14, width: 136 },
];

export function AllAutomationsTableClient({
  rows,
  authorChoices = [],
  triggerEventChoices = [],
  automationTagChoices = [],
}: {
  rows: AllAutomationRow[];
  /** Filter-menu options (the Dropdown Config Page choices). Same three
   *  dimensions as the Per Website filter; this table mirrors that feature. */
  authorChoices?: ChoiceOption[];
  triggerEventChoices?: ChoiceOption[];
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

  // Columns hidden via the "Columns" control, persisted for THIS page. Hiding is
  // by column POSITION (a scoped nth-child <style> below), so the hardcoded table
  // cells don't each need a per-cell visibility gate.
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(ALL_HIDDEN_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      const known = new Set(ALL_HIDEABLE_COLUMNS.map((c) => c.id));
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
  // CSS that hides each chosen column by position, scoped to this table.
  const hideColsCss = ALL_HIDEABLE_COLUMNS.filter((c) => hiddenColumns.has(c.id))
    .map(
      (c) =>
        `.all-cols-table>thead>tr>th:nth-child(${c.index}),.all-cols-table>tbody>tr>td:nth-child(${c.index}){display:none}`,
    )
    .join("");
  // Shrink the table min-width by the hidden columns' widths (base 2800).
  const tableMinWidth =
    2800 -
    ALL_HIDEABLE_COLUMNS.filter((c) => hiddenColumns.has(c.id)).reduce(
      (sum, c) => sum + c.width,
      0,
    );

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
          // Three groups that REVERSE COMPLETELY on the flip (asc: shared ->
          // unshared -> none; desc: none -> unshared -> shared). Intentionally
          // NOT the blanks-last rule the date columns + Author use — see the
          // comparator. Same shared comparator the Per Website table uses, so the
          // two pages cannot drift.
          return compareWebhookShared(a, b, dir);
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
            {ALL_HIDEABLE_COLUMNS.map((col) => (
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
                {col.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={hiddenCount === 0}
              onClick={showAllColumns}
            >
              Show all columns
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
            {/* Scoped CSS that hides the chosen columns by position (hideColsCss).
                suppressHydrationWarning: the rules come from localStorage, empty
                on the server and populated on the client. */}
            <style suppressHydrationWarning>{hideColsCss}</style>
            <table
              className="all-cols-table w-full text-sm"
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
                  <th
                    onClick={() => toggleSort("website")}
                    aria-sort={ariaSort("website")}
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Website
                      <SortArrow active={sortKey === "website"} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("status")}
                    aria-sort={ariaSort("status")}
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Status
                      <SortArrow active={sortKey === "status"} dir={sortDir} />
                    </span>
                  </th>
                  {/* Author: mirrors the Per Website column. Center-aligned,
                      sortable alphabetically ("None" sinks last), fixed 160px.
                      Sits between Status and Trigger Event (the two dropdown
                      cols). */}
                  <th
                    onClick={() => toggleSort("author")}
                    aria-sort={ariaSort("author")}
                    className="sticky top-0 z-10 w-[160px] min-w-[160px] max-w-[160px] cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Author
                      <SortArrow active={sortKey === "author"} dir={sortDir} />
                    </span>
                  </th>
                  {/* Automation Tags: mirrors the Per Website column, between
                      Author and Trigger Event. Multi-select, display-only, not
                      sortable; wrapping coloured chips. 200px. */}
                  <th className="sticky top-0 z-10 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                    Automation Tags
                  </th>
                  {/* Trigger Event: mirrors the Per Website column, after Author.
                      Display-only, not sortable, 160px. */}
                  <th className="sticky top-0 z-10 w-[160px] min-w-[160px] max-w-[160px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                    Trigger Event
                  </th>
                  <th className="sticky top-0 z-10 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                    Purpose
                  </th>
                  {/* Notes: mirrors Purpose, one column to its right (same as the
                      Per Website table). Display-only, not sortable. */}
                  <th className="sticky top-0 z-10 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                    Notes
                  </th>
                  {/* GHL Tags + GHL Forms: GHL-only columns; here on the combined
                      table they always render, but each cell is populated only for
                      GHL / GHL b2b rows (a muted "-" on the other platforms).
                      Plain-text lines (like Webhook Links), not chips. 180px. Sit
                      just LEFT of Webhook Links. */}
                  <th className="sticky top-0 z-10 w-[180px] min-w-[180px] max-w-[180px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                    GHL Tags
                  </th>
                  <th className="sticky top-0 z-10 w-[180px] min-w-[180px] max-w-[180px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                    GHL Forms
                  </th>
                  {/* Webhook Links: mirrors the Per Website column, after GHL Forms.
                      One truncated line per selected webhook. 240px. Sortable as a
                      GROUPING toggle (shared webhooks first), not a true ordering. */}
                  <th
                    onClick={() => toggleSort("webhooks")}
                    aria-sort={ariaSort("webhooks")}
                    className="sticky top-0 z-10 w-[240px] min-w-[240px] max-w-[240px] cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Webhook Links
                      <SortArrow active={sortKey === "webhooks"} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("lastEditedAt")}
                    aria-sort={ariaSort("lastEditedAt")}
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Last Edited
                      <SortArrow active={sortKey === "lastEditedAt"} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("lastRunAt")}
                    aria-sort={ariaSort("lastRunAt")}
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Last Runtime
                      <SortArrow active={sortKey === "lastRunAt"} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("lastErrorAt")}
                    aria-sort={ariaSort("lastErrorAt")}
                    className="sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7] transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Last Error
                      <SortArrow active={sortKey === "lastErrorAt"} dir={sortDir} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
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
                      <td className="px-3 py-2 text-center align-top">
                        {/* Clicking the website entry opens that platform's Per
                            Website Page. */}
                        <Link
                          href={`/automations/${r.platform}`}
                          title={`Open the ${websiteLabelFor(r.platform)} page`}
                          className="inline-flex rounded hover:underline"
                        >
                          <WebsiteBadge slug={r.platform} />
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center align-top">
                        {/* Status pill (badge): green for Active, neutral gray
                            for Paused. Matches the Per Website table + the house
                            badge convention. */}
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
                      {/* Author: the selected option as a coloured pill (badge +
                          text colours; plain text if none), or red "None" when
                          unset (mirrors the Per Website column). */}
                      <td className="w-[160px] min-w-[160px] max-w-[160px] px-3 py-2 text-center align-top">
                        {r.author ? (
                          <ColorBadge
                            value={r.author}
                            badgeColor={r.authorBadgeColor}
                            textColor={r.authorTextColor}
                          />
                        ) : (
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                      {/* Automation Tags: the selected tags as wrapping coloured
                          chips (plain text for a tag with no badge colour), or
                          red "None" when empty (mirrors the Per Website column). */}
                      <td className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-center align-top">
                        {r.automationTags && r.automationTags.length > 0 ? (
                          // 1-4 tags show in full. In a 5+ tag row, only chips
                          // whose name is 7+ chars shorten to 4 letters + "…" (full
                          // name on hover); shorter tags stay full — count-based.
                          <span className="flex flex-wrap justify-center gap-1">
                            {r.automationTags.map((t) => {
                              const truncate =
                                r.automationTags!.length > 4 && t.value.length >= 7;
                              const label = truncate
                                ? `${t.value.slice(0, 4)}…`
                                : t.value;
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
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                      {/* Trigger Event: the selected option as a coloured pill
                          (badge + text colours; plain text if none), or red
                          "None" when unset (mirrors the Per Website column). */}
                      <td className="w-[160px] min-w-[160px] max-w-[160px] px-3 py-2 text-center align-top">
                        {r.triggerEvent ? (
                          <ColorBadge
                            value={r.triggerEvent}
                            badgeColor={r.triggerEventBadgeColor}
                            textColor={r.triggerEventTextColor}
                          />
                        ) : (
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                      <td className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left align-top">
                        {/* Purpose: a preview that fills the FIXED-WIDTH column
                            (locked to 240px on th + td). Line count is ADAPTIVE:
                            `line-clamp-2` is the 2-line minimum, `WebkitLineClamp`
                            inline-style overrides it per row with however many lines
                            fit the (Name-driven) row height (see the measuring effect).
                            Click opens the read-only popup, hover shows a tooltip with
                            the full text. Same as the per-website table (no edit mode
                            here, so the blurb is always clickable). "None" (red) when
                            empty.
                            ⚠️ DO NOT add `block` to the button: Tailwind v4 emits
                            `.block{display:block}` after `.line-clamp-2{display:
                            -webkit-box}`, so block overrides the -webkit-box that
                            line-clamp needs and the clamp stops working. */}
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
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                      {/* Notes: mirrors the Purpose cell (display-only, reuses
                          purposeClamp for the row-height-driven clamp). */}
                      <td className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left align-top">
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
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                      {/* GHL Tags + GHL Forms: plain-text lines (like Webhook
                          Links), populated only for GHL / GHL b2b rows. Non-GHL
                          rows show a muted "-" (the column doesn't apply). Sit
                          just LEFT of Webhook Links. */}
                      <td className="w-[180px] min-w-[180px] max-w-[180px] px-3 py-2 text-left align-top">
                        {!columnVisibleOnPlatform("ghl_tags", r.platform) ? (
                          <span className="text-xs text-zinc-400">-</span>
                        ) : r.ghlTags && r.ghlTags.length > 0 ? (
                          <div
                            className="overflow-hidden"
                            // Cap the item list to the SAME height as the
                            // Purpose/Notes clamp (purposeClamp lines x 16px), so a
                            // row with many items shows only the lines that fit and
                            // never stretches the row taller than the Name-cell-
                            // driven height. Items beyond that are clipped (each
                            // item is a 16px text-xs line).
                            style={{ maxHeight: (purposeClamp[r.id] ?? 2) * 16 }}
                          >
                            {r.ghlTags.map((t, i, arr) => (
                              <div
                                key={t.id}
                                title={t.value}
                                className="truncate text-xs text-zinc-700"
                              >
                                {/* Gold "(N)" total-selected count on the first
                                    line (the cell clips the rest). */}
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
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                      <td className="w-[180px] min-w-[180px] max-w-[180px] px-3 py-2 text-left align-top">
                        {!columnVisibleOnPlatform("ghl_forms", r.platform) ? (
                          <span className="text-xs text-zinc-400">-</span>
                        ) : r.ghlForms && r.ghlForms.length > 0 ? (
                          <div
                            className="overflow-hidden"
                            // Cap the item list to the SAME height as the
                            // Purpose/Notes clamp (purposeClamp lines x 16px), so a
                            // row with many items shows only the lines that fit and
                            // never stretches the row taller than the Name-cell-
                            // driven height. Items beyond that are clipped (each
                            // item is a 16px text-xs line).
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
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                      {/* Webhook Links: one truncated line per selected webhook
                          (hover title shows the full URL); red "None" when empty.
                          Mirrors the Per Website column. 240px. */}
                      <td className="w-[240px] min-w-[240px] max-w-[240px] px-3 py-2 text-left align-top">
                        {r.webhooks && r.webhooks.length > 0 ? (
                          <div
                            className="overflow-hidden"
                            // Cap the item list to the SAME height as the
                            // Purpose/Notes clamp (purposeClamp lines x 16px), so a
                            // row with many items shows only the lines that fit and
                            // never stretches the row taller than the Name-cell-
                            // driven height. Items beyond that are clipped (each
                            // item is a 16px text-xs line).
                            style={{ maxHeight: (purposeClamp[r.id] ?? 2) * 16 }}
                          >
                            {/* Every webhook line opens the "related automations"
                                lookup (not just the gold count), so the whole
                                cell is an obvious click target. Mirrors the Per
                                Website table. */}
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
                          <span className="text-xs font-medium text-red-600">
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-center">
                        {r.lastEditedAt ? (
                          <span className="text-xs tabular-nums text-zinc-700">
                            {formatDateCell(r.lastEditedAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-center">
                        {r.lastRunAt ? (
                          <span className="text-xs tabular-nums text-zinc-700">
                            {formatDateCell(r.lastRunAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-center">
                        {/* Last Error: red MM-DD-YYYY, same as the per-website
                            table; "-" when none. */}
                        {r.lastErrorAt ? (
                          <span className="text-xs tabular-nums text-red-600">
                            {formatDateCell(r.lastErrorAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
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
