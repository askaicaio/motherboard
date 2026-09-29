// =============================================================
// Feature Integration "Alpha1", route /automations-feature-integration-alpha1
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE FEATURE INTEGRATION PAGE: **one merged matrix**.
// One of eight created together on 2026-09-29, after the user asked: "Got any
// suggestions on UI layout for this page? pls make as many Alphas as you can
// suggest".
//
// 📌 WHAT IT ANSWERS. The live page draws TWO tables with THE SAME FIVE
// COLUMNS, one under the other. That costs a second header row, a second card
// and the gap between them, and it breaks the one reading the columns are for:
// **you cannot run your eye down "Make" and see what Make does**, because the
// column restarts halfway down the page. Merging puts all eight capabilities
// under one set of headers, and buys the two things a single grid can then
// afford: a per-platform total at the foot and a per-capability count at the
// right.
//
// ⚠️ THE MARKS ARE THE LIVE PAGE'S, reading the same stored state. **ONLY THE
// LAYOUT DIFFERS.** Nothing here writes; the live page's toggling is off too
// (see TOGGLE_ENABLED in `feature-integration-tables.tsx`).
//
// ⚠️ IT IS A BENCH. `/automations/feature-integration` is untouched.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Check, Grid2x2Check, X } from "lucide-react";
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

const SELF = "/automations-feature-integration-alpha1";

/** The live page's mark, kept identical on purpose: the comparison between
 *  these eight is about LAYOUT, so the thing being laid out has to be the same
 *  object everywhere except where a bench is explicitly about the mark. */
function Mark({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label + ": " + (on ? "supported" : "not supported")}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-white",
        on ? "bg-green-600" : "bg-red-600",
      )}
    >
      {on ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
    </span>
  );
}

export default async function FeatureIntegrationAlpha1Page() {
  await requireAuth();
  const state = await getFeatureIntegrationMap();
  const on = (tableId: string, rowKey: string, slug: string) =>
    !!state[cellKey(tableId, rowKey, slug)];

  // Every capability across both groups, so the footer can total a column.
  const allCells = FEATURE_INTEGRATION_TABLES.flatMap((t) =>
    t.rows.map((r) => ({ tableId: t.id, rowKey: r.key })),
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[722px] space-y-6 p-6">
        <Link
          href="/automations/feature-integration"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feature Integration
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <Grid2x2Check className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Automations Feature Integration
            </h1>
            {/* ⚠️ THE BADGE IS HOW YOU KNOW WHICH BENCH THIS IS. The live page
                has none, and its absence is the tell. */}
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha1
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            One merged matrix. Both capability groups share the five website
            columns, so a platform reads as a single column top to bottom.
          </p>
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="whitespace-nowrap border-b px-3 py-2 text-left font-semibold text-zinc-900">
                    Capability
                  </th>
                  {AUTOMATION_SITES.map((site) => (
                    <th
                      key={site.slug}
                      className="border-b px-3 py-2 text-center font-medium"
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <SiteIcon icon={site.icon} iconColor={site.iconColor} />
                        {site.label}
                      </span>
                    </th>
                  ))}
                  {/* ⭐ THE RIGHT-HAND COUNT IS WHAT A MERGED GRID BUYS. On the
                      live page each table would need its own, and a count of
                      five printed twice reads as two different measures. */}
                  <th className="whitespace-nowrap border-b px-3 py-2 text-right font-medium">
                    Websites
                  </th>
                </tr>
              </thead>
              {FEATURE_INTEGRATION_TABLES.map((table) => (
                <tbody key={table.id}>
                  {/* The group header replaces what used to be a whole second
                      card: the same zinc-50 strip, one row tall. */}
                  <tr className="border-t bg-zinc-50/70">
                    <th
                      colSpan={AUTOMATION_SITES.length + 2}
                      scope="colgroup"
                      className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {table.cornerLabel}
                    </th>
                  </tr>
                  {table.rows.map((row) => {
                    const hits = AUTOMATION_SITES.filter((s) =>
                      on(table.id, row.key, s.slug),
                    ).length;
                    return (
                      <tr key={row.key} className="border-t">
                        <th
                          scope="row"
                          className="whitespace-nowrap px-3 py-2 text-left font-medium text-zinc-700"
                        >
                          {row.label}
                        </th>
                        {AUTOMATION_SITES.map((site) => (
                          <td key={site.slug} className="px-3 py-2 text-center">
                            <Mark
                              on={on(table.id, row.key, site.slug)}
                              label={
                                row.label +
                                " for " +
                                site.label +
                                " (" +
                                table.cornerLabel +
                                ")"
                              }
                            />
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-zinc-500">
                          {hits} of {AUTOMATION_SITES.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
              {/* ⭐ THE FOOTER IS THE POINT OF MERGING: eight capabilities in
                  one column means the column has a total worth printing. */}
              <tfoot>
                <tr className="border-t bg-zinc-50">
                  <th
                    scope="row"
                    className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    Total
                  </th>
                  {AUTOMATION_SITES.map((site) => {
                    const hits = allCells.filter((c) =>
                      on(c.tableId, c.rowKey, site.slug),
                    ).length;
                    return (
                      <td
                        key={site.slug}
                        className="px-3 py-2 text-center text-sm font-semibold tabular-nums text-zinc-900"
                      >
                        {hits}
                        <span className="font-normal text-zinc-400">
                          /{allCells.length}
                        </span>
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <OtherLayouts />
      </div>
    </div>
  );
}

/** The hop strip every one of these eight carries, so you can compare without
 *  going back. **It lists the siblings, never itself.**
 *  ⚠️ Deliberately NOT a shared component: bench pages do not share layout, so
 *  this is eight near-copies on purpose. `VersionTile` inside it is a leaf. */
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
