// =============================================================
// Feature Integration "Alpha6", route /automations-feature-integration-alpha6
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE FEATURE INTEGRATION PAGE: **a dense board, the
// whole thing at a glance**. One of eight created together on 2026-09-29.
//
// 📌 WHAT IT ANSWERS. Forty booleans currently occupy two cards, two header
// rows and roughly 520px of height, because every one of them is drawn as a
// 24px badge with a glyph inside it. **That is a lot of ink for forty bits.**
// Here the same forty are dots on one board about 280px tall, with totals in
// both margins, so the entire integration picture is one glance and the page
// never scrolls.
//
// ⚠️⚠️ HOW THIS DIFFERS FROM ALPHA1, since both merge the two tables. Alpha1
// merges at FULL SIZE and spends what it saves on a per-row count and a
// per-column total, keeping the live page's weight. **This one is about
// DENSITY**: it drops the glyphs for dots, halves the row height and gives up
// the badge entirely. Compare them side by side; they are the same structure
// at two very different volumes.
//
// 🛑 A DOT IS NOT SELF-EXPLANATORY THE WAY A TICK IS, so the legend is not
// decoration and must not be dropped. Every dot also carries its own
// aria-label, because colour alone is not an accessible answer.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Grid3x3 } from "lucide-react";
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

const SELF = "/automations-feature-integration-alpha6";

/** Solid green = supported, hollow red ring = not. **Shape carries the
 *  meaning as well as colour**, so the board still reads without colour
 *  vision, which a pair of green and red dots would not. */
function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label + ": " + (on ? "supported" : "not supported")}
      className={cn(
        "mx-auto block h-2.5 w-2.5 rounded-full",
        on ? "bg-green-600" : "border-2 border-red-400 bg-transparent",
      )}
    />
  );
}

export default async function FeatureIntegrationAlpha6Page() {
  await requireAuth();
  const state = await getFeatureIntegrationMap();
  const on = (tableId: string, rowKey: string, slug: string) =>
    !!state[cellKey(tableId, rowKey, slug)];

  const allCells = FEATURE_INTEGRATION_TABLES.flatMap((t) =>
    t.rows.map((r) => ({ tableId: t.id, rowKey: r.key })),
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[492px] space-y-6 p-6">
        <Link
          href="/automations/feature-integration"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feature Integration
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Automations Feature Integration
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha6
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            One dense board. Forty answers, totals in both margins, and no
            scrolling to see all of it.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="w-[1%] whitespace-nowrap px-3 pb-1.5 pt-3 text-left font-medium">
                    Capability
                  </th>
                  {AUTOMATION_SITES.map((site) => (
                    <th
                      key={site.slug}
                      className="px-2 pb-1.5 pt-3 text-center font-medium"
                    >
                      <span className="inline-flex items-center gap-1">
                        <SiteIcon
                          icon={site.icon}
                          iconColor={site.iconColor}
                          className="h-3.5 w-3.5"
                        />
                        {site.label}
                      </span>
                    </th>
                  ))}
                  <th className="w-[1%] whitespace-nowrap px-3 pb-1.5 pt-3 text-right font-medium">
                    n
                  </th>
                </tr>
              </thead>
              {FEATURE_INTEGRATION_TABLES.map((table) => (
                <tbody key={table.id}>
                  <tr>
                    <th
                      colSpan={AUTOMATION_SITES.length + 2}
                      scope="colgroup"
                      className="border-t bg-zinc-50 px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {table.cornerLabel}
                    </th>
                  </tr>
                  {table.rows.map((row) => {
                    const hits = AUTOMATION_SITES.filter((s) =>
                      on(table.id, row.key, s.slug),
                    ).length;
                    return (
                      // No row borders: at this density the rules would
                      // outweigh the data. A hover tint does the tracking job.
                      <tr key={row.key} className="hover:bg-zinc-50">
                        <th
                          scope="row"
                          className="whitespace-nowrap px-3 py-1 text-left font-normal text-zinc-700"
                        >
                          {row.label}
                        </th>
                        {AUTOMATION_SITES.map((site) => (
                          <td key={site.slug} className="px-2 py-1">
                            <Dot
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
                        <td className="px-3 py-1 text-right tabular-nums text-zinc-400">
                          {hits}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
              <tfoot>
                <tr className="border-t">
                  <th
                    scope="row"
                    className="whitespace-nowrap px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
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
                        className="px-2 py-1.5 text-center font-semibold tabular-nums text-zinc-900"
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

            {/* 🛑 THE LEGEND IS LOAD-BEARING HERE. A tick and a cross explain
                themselves; two dots do not. */}
            <div className="flex items-center gap-4 border-t bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="block h-2.5 w-2.5 rounded-full bg-green-600" />
                supported
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="block h-2.5 w-2.5 rounded-full border-2 border-red-400" />
                not supported
              </span>
              <span className="ml-auto">
                n = websites supporting that capability
              </span>
            </div>
          </CardContent>
        </Card>

        <OtherLayouts />
      </div>
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
