// =============================================================
// Feature Integration "Alpha5", route /automations-feature-integration-alpha5
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE FEATURE INTEGRATION PAGE: **gaps first**. One of
// eight created together on 2026-09-29.
//
// 📌 WHAT IT ANSWERS. Nobody opens this page to be told Make works. **The
// question is what is missing and where**, and on the live page that means
// hunting for red across forty cells. Here the gaps come first, sorted by how
// many each website has, and the websites with nothing missing are a single
// line at the bottom. The information is identical; the order is inverted.
//
// ⚠️⚠️ THE GROUPING IS BY WEBSITE, NOT BY CAPABILITY, AND THAT WAS A
// MEASUREMENT NOT A PREFERENCE. Grouping by capability into
// everywhere/partial/nowhere buckets **puts all eight capabilities in the same
// bucket** on today's data (every one of them is supported by some websites
// and not others), so two of the three headings would render empty and the
// third would be the whole page. Grouping by website spreads 8 / 4 / 4 / 0 / 0
// and actually sorts. 📌 **CHECK WHAT A GROUPING PRODUCES ON THE REAL DATA
// BEFORE BUILDING IT**; the same lesson as the Alpha5 work queue on the hub.
//
// ⚠️ IT READS THE SAME STORED STATE as the live page. Nothing writes, and the
// buckets recompute themselves if a mark ever changes.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Check, TriangleAlert, X } from "lucide-react";
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

const SELF = "/automations-feature-integration-alpha5";

export default async function FeatureIntegrationAlpha5Page() {
  await requireAuth();
  const state = await getFeatureIntegrationMap();
  const on = (tableId: string, rowKey: string, slug: string) =>
    !!state[cellKey(tableId, rowKey, slug)];

  const total = FEATURE_INTEGRATION_TABLES.reduce(
    (n, t) => n + t.rows.length,
    0,
  );

  // One entry per website: what it is missing, grouped by capability set so a
  // whole missing group reads as one line rather than four.
  const audit = AUTOMATION_SITES.map((site) => {
    const groups = FEATURE_INTEGRATION_TABLES.map((table) => ({
      id: table.id,
      label: table.cornerLabel,
      size: table.rows.length,
      missing: table.rows.filter((r) => !on(table.id, r.key, site.slug)),
    })).filter((g) => g.missing.length > 0);
    const missingCount = groups.reduce((n, g) => n + g.missing.length, 0);
    return { site, groups, missingCount };
  });

  // Worst first: the sort is the feature. A gap list in website order would
  // just be the live page's column order with extra words.
  const withGaps = audit
    .filter((a) => a.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount);
  const clean = audit.filter((a) => a.missingCount === 0);

  return (
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
          <TriangleAlert className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Automations Feature Integration
          </h1>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Alpha5
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Gaps first. What is missing, worst website first, with everything that
          already works folded into one line at the bottom.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Not available
            </h2>
            <span className="text-xs text-zinc-500">
              {withGaps.reduce((n, a) => n + a.missingCount, 0)} of{" "}
              {total * AUTOMATION_SITES.length} combinations
            </span>
          </div>

          {withGaps.length === 0 ? (
            // The state this layout is built to reach. Worth saying out loud
            // rather than rendering an empty card.
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              Nothing is missing. Every website supports every capability on
              this page.
            </div>
          ) : (
            <div className="divide-y">
              {withGaps.map(({ site, groups, missingCount }) => (
                <div key={site.slug} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SiteIcon
                      icon={site.icon}
                      iconColor={site.iconColor}
                      className="h-5 w-5"
                    />
                    <span className="text-sm font-semibold text-zinc-900">
                      {site.label}
                    </span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-red-700">
                      {missingCount} of {total} missing
                    </span>
                  </div>

                  <ul className="mt-2 space-y-1.5">
                    {groups.map((group) => (
                      <li
                        key={group.id}
                        className="flex flex-col gap-1 text-sm @min-[640px]:flex-row @min-[640px]:items-baseline @min-[640px]:gap-3"
                      >
                        <span className="shrink-0 text-zinc-500">
                          {group.label}
                          {/* ⭐ "all four" IS THE POINT OF GROUPING. A website
                              that supports none of a capability set is one
                              fact, not four, and listing four names hides
                              that. */}
                          {group.missing.length === group.size ? (
                            <span className="ml-1 font-medium text-red-700">
                              (none of {group.size})
                            </span>
                          ) : null}
                        </span>
                        <span className="min-w-0 text-zinc-700">
                          {group.missing.map((r) => r.label).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Fully supported
            </h2>
            <span className="text-xs text-zinc-500">
              {clean.length} of {AUTOMATION_SITES.length} websites
            </span>
          </div>
          {clean.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              No website supports all {total} capabilities yet.
            </div>
          ) : (
            // Deliberately one compact line. Everything here is settled, and
            // settled things do not need a row each.
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              {clean.map(({ site }) => (
                <span
                  key={site.slug}
                  className="inline-flex items-center gap-1.5 rounded-full bg-green-50 py-1 pl-1.5 pr-2.5 ring-1 ring-green-200"
                >
                  <SiteIcon
                    icon={site.icon}
                    iconColor={site.iconColor}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-zinc-900">
                    {site.label}
                  </span>
                  <Check
                    className="h-3.5 w-3.5 text-green-700"
                    aria-label="all capabilities supported"
                  />
                </span>
              ))}
              <span className="text-xs text-zinc-500">
                all {total} capabilities
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The full grid stays, small and last, because inverting the order is
          only defensible if nothing is actually taken away. */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <div className="border-b bg-zinc-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Everything, for reference
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium">
                  Capability
                </th>
                {AUTOMATION_SITES.map((site) => (
                  <th
                    key={site.slug}
                    className="px-2 py-2 text-center text-xs font-medium"
                  >
                    {site.label}
                  </th>
                ))}
              </tr>
            </thead>
            {FEATURE_INTEGRATION_TABLES.map((table) => (
              <tbody key={table.id}>
                <tr className="border-t bg-zinc-50/70">
                  <th
                    colSpan={AUTOMATION_SITES.length + 1}
                    scope="colgroup"
                    className="px-4 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {table.cornerLabel}
                  </th>
                </tr>
                {table.rows.map((row) => (
                  <tr key={row.key} className="border-t">
                    <th
                      scope="row"
                      className="whitespace-nowrap px-4 py-1.5 text-left font-normal text-zinc-700"
                    >
                      {row.label}
                    </th>
                    {AUTOMATION_SITES.map((site) => {
                      const yes = on(table.id, row.key, site.slug);
                      return (
                        <td key={site.slug} className="px-2 py-1.5">
                          <span
                            role="img"
                            aria-label={
                              row.label +
                              " for " +
                              site.label +
                              " (" +
                              table.cornerLabel +
                              "): " +
                              (yes ? "supported" : "not supported")
                            }
                            className={cn(
                              "mx-auto flex h-4 w-4 items-center justify-center rounded text-white",
                              yes ? "bg-green-600" : "bg-red-600",
                            )}
                          >
                            {yes ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </CardContent>
      </Card>

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
