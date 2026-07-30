"use client";

// =============================================================
// <DataTable> — the reusable sortable / filterable / groupable table
// =============================================================
// House default for data tables. Hand-rolled (not @tanstack/react-table) to
// match the existing partners-client / events-client patterns and to stay
// palette-agnostic: it renders neutral markup + accepts className overrides,
// so it fits both the portal (slate/indigo) and admin (zinc) surfaces.
//
// Features, all opt-in via the column/group config:
//   • Global search — shown when any column defines `filterValue`.
//   • Click-to-sort — enabled per column when `sortAccessor` is set.
//   • Grouping — a "Group by" toggle appears when `groupBy` is passed; rows
//     bucket under colSpan subheaders.
//   • Header tooltips — `headerTooltip` renders an info affordance (e.g. the
//     "expected payout date" grace-period note).
// =============================================================

import * as React from "react";
import { useMemo, useState } from "react";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Info,
  Layers,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Presence makes the header click-to-sort. Return null to sort last. */
  sortAccessor?: (row: T) => string | number | null;
  /** Contributes this row's value to the global search haystack. */
  filterValue?: (row: T) => string;
  align?: "left" | "right";
  /** Renders an info tooltip beside the header label. */
  headerTooltip?: React.ReactNode;
  /** Extra className for this column's <td>. */
  cellClassName?: string;
}

export interface DataTableGroup<T> {
  keyOf: (row: T) => string;
  label?: (key: string) => string;
  /** Group display order; keys not listed sort alphabetically after. */
  order?: string[];
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  filterPlaceholder?: string;
  groupBy?: DataTableGroup<T>;
  /** Label for the group toggle, e.g. "Group by status". */
  groupToggleLabel?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  /** Extra toolbar controls (e.g. a status dropdown), right-aligned. */
  toolbarExtra?: React.ReactNode;
  className?: string;
}

/**
 * NOTE: memoize (or hoist) the `columns` and `groupBy` props in the caller.
 * The internal filter/sort/group memos depend on them, so a fresh array/object
 * identity every render makes those memos recompute each render. Correctness is
 * unaffected — it's purely a perf consideration for large tables.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  filterPlaceholder = "Search…",
  groupBy,
  groupToggleLabel = "Group",
  initialSort,
  onRowClick,
  emptyState,
  toolbarExtra,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    initialSort?.dir ?? "asc",
  );
  const [grouped, setGrouped] = useState(false);

  const searchable = columns.some((c) => c.filterValue);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      columns.some((c) => c.filterValue?.(row)?.toLowerCase().includes(q)),
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortAccessor) return filtered;
    const acc = col.sortAccessor;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va = acc(a);
      let vb = acc(b);
      // Treat NaN like null so the comparator stays transitive.
      if (typeof va === "number" && Number.isNaN(va)) va = null;
      if (typeof vb === "number" && Number.isNaN(vb)) vb = null;
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls/NaN always last
      if (vb == null) return -1;
      // Numeric subtraction only when BOTH are finite numbers; otherwise
      // compare as strings for every pair (keeps mixed-type columns transitive).
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, columns]);

  const groups = useMemo(() => {
    if (!grouped || !groupBy) return null;
    const map = new Map<string, T[]>();
    for (const row of sorted) {
      const k = groupBy.keyOf(row);
      const bucket = map.get(k);
      if (bucket) bucket.push(row);
      else map.set(k, [row]);
    }
    const rank = (k: string) => {
      const i = groupBy.order?.indexOf(k) ?? -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const keys = [...map.keys()].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      return ra !== rb ? ra - rb : a.localeCompare(b);
    });
    return keys.map((k) => ({
      key: k,
      label: groupBy.label ? groupBy.label(k) : k,
      rows: map.get(k)!,
    }));
  }, [sorted, grouped, groupBy]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const colCount = columns.length;

  return (
    <TooltipProvider>
      <div className={cn("space-y-3", className)}>
        {(searchable || groupBy || toolbarExtra) && (
          <div className="flex flex-wrap items-center gap-2">
            {searchable && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={filterPlaceholder}
                  className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-[#1e1b4b] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            )}
            {groupBy && (
              <button
                type="button"
                onClick={() => setGrouped((g) => !g)}
                aria-pressed={grouped}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                  grouped
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <Layers className="h-4 w-4" />
                {groupToggleLabel}
              </button>
            )}
            {toolbarExtra && <div className="ml-auto">{toolbarExtra}</div>}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  {columns.map((col) => {
                    const sortable = !!col.sortAccessor;
                    const active = sortKey === col.key;
                    return (
                      <th
                        key={col.key}
                        aria-sort={
                          active
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : sortable
                              ? "none"
                              : undefined
                        }
                        className={cn("px-5 py-3", col.align === "right" && "text-right")}
                      >
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            col.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {sortable ? (
                            // Real button so sorting is keyboard-reachable and
                            // announced to assistive tech.
                            <button
                              type="button"
                              onClick={() => handleSort(col.key)}
                              className="inline-flex items-center gap-1 rounded outline-none hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                            >
                              {col.header}
                              {active ? (
                                sortDir === "asc" ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )
                              ) : (
                                <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                              )}
                            </button>
                          ) : (
                            col.header
                          )}
                          {col.headerTooltip && (
                            <Tooltip>
                              <TooltipTrigger
                                type="button"
                                className="inline-flex text-slate-400 outline-none hover:text-slate-600 focus-visible:text-slate-600"
                                aria-label="More info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-left normal-case tracking-normal">
                                {col.headerTooltip}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-5 py-10 text-center text-sm text-slate-500">
                      {emptyState ?? "Nothing to show."}
                    </td>
                  </tr>
                ) : groups ? (
                  groups.map((g) => (
                    <React.Fragment key={g.key}>
                      <tr className="bg-slate-50/70">
                        <td
                          colSpan={colCount}
                          className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {g.label}
                          <span className="ml-2 font-normal text-slate-400">
                            {g.rows.length}
                          </span>
                        </td>
                      </tr>
                      {g.rows.map((row) => (
                        <Row
                          key={getRowId(row)}
                          row={row}
                          columns={columns}
                          onRowClick={onRowClick}
                        />
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  sorted.map((row) => (
                    <Row
                      key={getRowId(row)}
                      row={row}
                      columns={columns}
                      onRowClick={onRowClick}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Row<T>({
  row,
  columns,
  onRowClick,
}: {
  row: T;
  columns: DataTableColumn<T>[];
  onRowClick?: (row: T) => void;
}) {
  return (
    <tr
      className={cn("hover:bg-slate-50", onRowClick && "cursor-pointer")}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      {columns.map((col) => (
        <td
          key={col.key}
          className={cn(
            "px-5 py-3.5",
            col.align === "right" && "text-right tabular-nums",
            col.cellClassName,
          )}
        >
          {col.cell(row)}
        </td>
      ))}
    </tr>
  );
}
