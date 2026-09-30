"use client";

// Version Directory Alpha5's client: the search box, the chips and the list.
// =============================================================
// ⚠️ EVERYTHING FILTERS IN MEMORY. The registry is a static array of 28, so
// there is no request to make and no debounce to write; **adding either would
// be machinery for a problem that does not exist at this size.**
// =============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AUTOMATION_VERSIONS,
  versionGroupLabel,
  versionStatusKey,
} from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-zinc-900 text-white" },
  shipped: { label: "Shipped", className: "bg-green-100 text-green-800" },
  parked: { label: "Parked", className: "bg-amber-100 text-amber-800" },
  bench: { label: "Bench", className: "bg-blue-100 text-blue-800" },
  archived: { label: "Archived", className: "bg-zinc-200 text-zinc-600" },
};

const STATUS_ORDER = ["live", "shipped", "parked", "bench", "archived"];

export function VersionDirectoryAlpha5Client() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      AUTOMATION_VERSIONS.map((v) => ({
        v,
        group: versionGroupLabel(v),
        status: versionStatusKey(v),
        // Pre-lowercased once, so the filter below is not doing it 28 times
        // per keystroke. **The blurb is in here on purpose**: it is the only
        // place a design's actual idea is written down.
        haystack: (v.label + " " + v.blurb + " " + v.href).toLowerCase(),
      })),
    [],
  );

  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const r of rows) if (!seen.includes(r.group)) seen.push(r.group);
    return seen;
  }, [rows]);

  const q = query.trim().toLowerCase();
  const results = rows.filter(
    (r) =>
      (q === "" || r.haystack.includes(q)) &&
      (group === null || r.group === group) &&
      (status === null || r.status === status),
  );

  const filtering = q !== "" || group !== null || status !== null;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search names and descriptions"
            aria-label="Search design versions"
            className="pl-9"
          />
        </div>

        {/* Two chip rows, labelled. An unlabelled mixed row would make
            "Parked" and "Light / Dark Mode" look like the same kind of
            filter, and they are not: one is a state, one is a subject. */}
        <ChipRow
          label="Experiment"
          options={groups}
          value={group}
          onChange={setGroup}
        />
        <ChipRow
          label="State"
          options={STATUS_ORDER}
          value={status}
          onChange={setStatus}
          render={(key) => STATUS[key].label}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2">
            <span className="text-sm text-zinc-600">
              <span className="font-semibold text-zinc-900">
                {results.length}
              </span>{" "}
              of {rows.length} versions
            </span>
            {filtering ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setGroup(null);
                  setStatus(null);
                }}
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            ) : null}
          </div>

          {results.length === 0 ? (
            // ⚠️ THE EMPTY STATE NAMES THE FILTERS, not just the query. With
            // three controls it is easy to have a chip set from a minute ago
            // and read "no results" as "nothing exists".
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Nothing matches{q ? ` "${query.trim()}"` : ""}
              {group ? ` in ${group}` : ""}
              {status ? ` with state ${STATUS[status].label}` : ""}.
            </p>
          ) : (
            <div className="divide-y">
              {results.map(({ v, group: g, status: s }) => (
                <Link
                  key={v.href}
                  href={v.href}
                  target="_blank"
                  rel="noreferrer"
                  prefetch={false}
                  className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
                >
                  <v.icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-zinc-900">
                        {v.label}
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                        {g}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          STATUS[s].className,
                        )}
                      >
                        {STATUS[s].label}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {v.blurb}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** One labelled row of single-select chips. Clicking the active one clears
 *  it, so there is no separate "All" chip to keep in sync. */
function ChipRow({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (next: string | null) => void;
  render?: (option: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-zinc-500">{label}</span>
      {options.map((option) => {
        const on = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : option)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition-colors",
              on
                ? "bg-zinc-900 font-medium text-white"
                : "text-zinc-600 ring-1 ring-foreground/10 hover:bg-zinc-50",
            )}
          >
            {render ? render(option) : option}
          </button>
        );
      })}
    </div>
  );
}
