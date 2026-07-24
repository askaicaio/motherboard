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
import { Search, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
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
  | "lastErrorAt";

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

export function AllAutomationsTableClient({
  rows,
}: {
  rows: AllAutomationRow[];
}) {
  const [query, setQuery] = useState("");
  // The purpose text shown in the read-only popup (null = closed).
  const [showingPurpose, setShowingPurpose] = useState<string | null>(null);
  // Adaptive Purpose clamp (see the per-website AutomationsTableClient for the
  // full rationale): line count per row, sized to the fixed-width Name cell so
  // taller rows fill their height instead of leaving a 2-line gap.
  const [purposeClamp, setPurposeClamp] = useState<Record<string, number>>({});
  const nameCellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
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
    const base = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.externalUrl ?? "").toLowerCase().includes(q),
        )
      : rows;
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
        default:
          return 0;
      }
    });
  }, [rows, query, sortKey, sortDir]);

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
      {/* Search bar, matches NAME or LINK (same as the per-website table). */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search automations by name or link…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
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
            <table className="w-full min-w-[1400px] text-sm">
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
                  <th className="sticky top-0 z-10 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap bg-zinc-50 px-3 py-2 text-center shadow-[inset_0_-1px_0_0_#e4e4e7]">
                    Purpose
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
                      colSpan={7}
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
    </div>
  );
}
