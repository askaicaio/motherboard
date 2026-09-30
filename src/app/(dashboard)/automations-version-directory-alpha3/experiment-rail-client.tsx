"use client";

// Version Directory Alpha3's client: the experiment rail and its list.
// =============================================================
// ⚠️ A CLIENT COMPONENT ONLY BECAUSE SOMETHING IS SELECTED. The registry is
// static, so nothing here fetches; the state is one string.
//
// ⚠️ THE GROUPS COME FROM `versionGroupLabel`, NOT FROM `family`. Several
// versions have no family at all (the Main Page betas and alphas, the toolbar
// gallery), and giving them one would change what
// `AUTOMATION_BENCH_VERSIONS` means on the live page. **The label is the cheap
// half of that idea and the filter semantics were the expensive half**; see
// the function's own note.
// =============================================================

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

/** Rail order. ⚠️ **It is not alphabetical and must not become so**: the live
 *  page belongs at the top and the archive at the bottom, and the middle runs
 *  oldest experiment to newest, which is the order they will be reasoned
 *  about in. Any group the registry grows that is not named here still
 *  renders, at the end. */
const ORDER = [
  "Live page",
  "Main Page",
  "Light / Dark Mode",
  "Dropdown Configuration",
  "Feature Integration",
  "Version Directory",
  "Toolbar Options",
];

export function VersionDirectoryAlpha3Client() {
  const groups: { name: string; items: typeof AUTOMATION_VERSIONS }[] = [];
  for (const v of AUTOMATION_VERSIONS) {
    const name = versionGroupLabel(v);
    const found = groups.find((g) => g.name === name);
    if (found) found.items.push(v);
    else groups.push({ name, items: [v] });
  }
  groups.sort((a, b) => {
    const ia = ORDER.indexOf(a.name);
    const ib = ORDER.indexOf(b.name);
    return (ia < 0 ? ORDER.length : ia) - (ib < 0 ? ORDER.length : ib);
  });

  // ⭐ THE DEFAULT IS THE BIGGEST EXPERIMENT, not the first row. Landing on
  // "Live page" would show a single tile and make the rail look like it leads
  // nowhere, which is the opposite of the argument this bench is making.
  const widest = groups.reduce(
    (best, g) => (g.items.length > best.items.length ? g : best),
    groups[0],
  );
  const [active, setActive] = useState<string>(widest.name);
  const current = groups.find((g) => g.name === active) ?? groups[0];

  return (
    <div className="flex items-start gap-4">
      <nav aria-label="Design experiments" className="w-60 shrink-0 space-y-1">
        {groups.map((g) => {
          const on = g.name === current.name;
          return (
            <button
              key={g.name}
              type="button"
              onClick={() => setActive(g.name)}
              aria-current={on ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                on
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 ring-1 ring-foreground/10 hover:bg-zinc-50",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {g.name}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  on ? "bg-white/15 text-white" : "bg-zinc-200 text-zinc-700",
                )}
              >
                {g.items.length}
              </span>
            </button>
          );
        })}
      </nav>

      <Card className="min-w-0 flex-1">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              {current.name}
            </h2>
            <span className="text-xs text-zinc-500">
              {current.items.length} pages, each opens in a new tab
            </span>
          </div>
          <div className="divide-y">
            {current.items.map((v) => {
              const tone = STATUS[versionStatusKey(v)];
              return (
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
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          tone.className,
                        )}
                      >
                        {tone.label}
                      </span>
                      {v.shipped ? (
                        <span className="text-[11px] text-zinc-500">
                          runs {v.shipped.label}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {v.blurb}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
