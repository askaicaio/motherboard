// =============================================================
// Feature Integration "Alpha3", route /automations-feature-integration-alpha3
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE FEATURE INTEGRATION PAGE: **one card per website,
// no grid at all**. One of eight created together on 2026-09-29.
//
// 📌 WHAT IT ANSWERS. A matrix makes you hold a column position in your head
// while your eye travels down it. With only five websites and eight
// capabilities there is no need for a grid: **each website can own a card and
// say its eight answers in words.** Every mark sits next to the label it
// belongs to, so nothing has to be counted across.
//
// ⭐⭐ THE REAL PRIZE IS WIDTH. This is the only one of the eight with no wide
// element in it, so the page needs no 722px floor and no sideways scroll; the
// cards reflow from three columns to one. **A layout that answers to its own
// container is the only kind that survives a narrow window**, which is the
// thing the 2026-09-23 pass had to bolt a floor onto every other page for.
//
// ⚠️ THE MARKS READ THE SAME STORED STATE as the live page, in a smaller size
// because they now sit in running text rather than in cells. Nothing writes.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Check, LayoutGrid, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SiteIcon } from "@/components/automations/site-icon";
import { VersionTile } from "@/components/automations/version-tile";
import { getFeatureIntegrationMap } from "@/lib/automations/feature-integration";
import {
  FEATURE_INTEGRATION_TABLES,
  cellKey,
} from "@/lib/automations/feature-integration-spec";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { AUTOMATION_FEATURE_INTEGRATION_VERSIONS } from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SELF = "/automations-feature-integration-alpha3";

/** Smaller than the live mark on purpose: here it sits inline beside a label
 *  instead of alone in a cell, so a 24px square would shout. */
function Mark({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label + ": " + (on ? "supported" : "not supported")}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-white",
        on ? "bg-green-600" : "bg-red-600",
      )}
    >
      {on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
    </span>
  );
}

export default async function FeatureIntegrationAlpha3Page() {
  await requireAuth();
  const state = await getFeatureIntegrationMap();
  const on = (tableId: string, rowKey: string, slug: string) =>
    !!state[cellKey(tableId, rowKey, slug)];

  const total = FEATURE_INTEGRATION_TABLES.reduce(
    (n, t) => n + t.rows.length,
    0,
  );

  return (
    // 🛑 NO `overflow-x-auto` AND NO WIDTH FLOOR, UNLIKE EVERY OTHER BENCH
    // HERE. That absence IS the design. Adding either back would throw away
    // the only thing this layout is offering over the live page.
    <div className="@container space-y-6 p-6">
      <Link
        href="/automations/feature-integration"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Feature Integration
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Automations Feature Integration
          </h1>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Alpha3
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          A card per website instead of a grid. Every mark sits beside its own
          label, and the page reflows instead of scrolling sideways.
        </p>
      </div>

      <div className="grid gap-4 @min-[560px]:grid-cols-2 @min-[860px]:grid-cols-3">
        {AUTOMATION_SITES.map((site) => {
          const hits = FEATURE_INTEGRATION_TABLES.reduce(
            (n, t) =>
              n + t.rows.filter((r) => on(t.id, r.key, site.slug)).length,
            0,
          );
          return (
            <Card key={site.slug}>
              <CardContent className="p-0">
                {/* Card header: the logo at reading size, the name, and the
                    score. The score is the whole reason a card beats a column:
                    a column header has nowhere to put it. */}
                <div className="flex items-center gap-2 border-b bg-zinc-50 px-3 py-2">
                  <SiteIcon
                    icon={site.icon}
                    iconColor={site.iconColor}
                    className="h-5 w-5"
                  />
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">
                    {site.label}
                  </h2>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                      hits === 0
                        ? "bg-red-100 text-red-700"
                        : hits === total
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-200 text-zinc-700",
                    )}
                  >
                    {hits} / {total}
                  </span>
                </div>

                <div className="divide-y">
                  {FEATURE_INTEGRATION_TABLES.map((table) => (
                    <div key={table.id} className="px-3 py-2.5">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        {table.cornerLabel}
                      </h3>
                      <ul className="mt-1.5 space-y-1.5">
                        {table.rows.map((row) => {
                          const yes = on(table.id, row.key, site.slug);
                          return (
                            <li
                              key={row.key}
                              className="flex items-center gap-2"
                            >
                              <Mark
                                on={yes}
                                label={
                                  row.label +
                                  " for " +
                                  site.label +
                                  " (" +
                                  table.cornerLabel +
                                  ")"
                                }
                              />
                              {/* Muted when absent, so a card of red reads as
                                  "nothing here" at a glance rather than as
                                  eight equally loud statements. */}
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate text-sm",
                                  yes ? "text-zinc-700" : "text-zinc-400",
                                )}
                              >
                                {row.label}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <OtherLayouts />
    </div>
  );
}

function OtherLayouts() {
  const others = AUTOMATION_FEATURE_INTEGRATION_VERSIONS.filter(
    (v) => v.href !== SELF,
  );
  if (others.length === 0) return null;
  return (
    <Card>
      <CardContent className="@container p-0">
        <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            The other layouts
          </h2>
          <span className="text-xs text-zinc-500">
            {others.length} pages, each opens in a new tab
          </span>
        </div>
        <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
          {others.map((version) => (
            <VersionTile key={version.href} version={version} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
