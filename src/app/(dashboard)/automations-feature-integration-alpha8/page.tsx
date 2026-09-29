// =============================================================
// Feature Integration "Alpha8", route /automations-feature-integration-alpha8
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE FEATURE INTEGRATION PAGE: **the headline first,
// the grid second**. One of eight created together on 2026-09-29.
//
// 📌 WHAT IT ANSWERS. Both capability groups have a one-sentence answer
// ("Refresh List works on four of the five websites") and on the live page
// **you can only get it by counting**. This bench prints the sentence, then
// keeps the full grid underneath at a smaller weight. Nothing is removed; the
// summary is added above it and the detail stops being the first thing you
// meet.
//
// ⚠️⚠️ "SUPPORTED" IS DELIBERATELY A THREE-WAY COUNT, NOT A TICK. A website
// that does three of a group's four fields is not a yes and not a no, and a
// headline that rounded it either way would be the kind of summary that is
// worse than no summary. **Today nothing is partial**, which is exactly when
// it is cheap to get right: the bucket is built, it renders only when it has
// members, and the day a half-integration lands the headline will not lie.
//
// ⚠️ THE MARKS READ THE SAME STORED STATE. Nothing writes.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Check, Gauge, X } from "lucide-react";
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

const SELF = "/automations-feature-integration-alpha8";

export default async function FeatureIntegrationAlpha8Page() {
  await requireAuth();
  const state = await getFeatureIntegrationMap();
  const on = (tableId: string, rowKey: string, slug: string) =>
    !!state[cellKey(tableId, rowKey, slug)];

  const summary = FEATURE_INTEGRATION_TABLES.map((table) => {
    const buckets = AUTOMATION_SITES.map((site) => {
      const n = table.rows.filter((r) => on(table.id, r.key, site.slug)).length;
      return {
        site,
        n,
        kind: n === table.rows.length ? "full" : n === 0 ? "none" : "partial",
      };
    });
    return {
      table,
      full: buckets.filter((b) => b.kind === "full"),
      partial: buckets.filter((b) => b.kind === "partial"),
      none: buckets.filter((b) => b.kind === "none"),
    };
  });

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
          <Gauge className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Automations Feature Integration
          </h1>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Alpha8
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          The headline first. Each capability says how far it reaches before the
          grid asks you to count.
        </p>
      </div>

      <div className="grid gap-4 @min-[720px]:grid-cols-2">
        {summary.map(({ table, full, partial, none }) => {
          const pct = Math.round((full.length / AUTOMATION_SITES.length) * 100);
          return (
            <Card key={table.id}>
              <CardContent className="p-4">
                <h2 className="text-sm font-medium text-zinc-500">
                  {table.cornerLabel}
                </h2>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
                  {full.length}
                  <span className="text-base font-normal text-zinc-400">
                    {" "}
                    of {AUTOMATION_SITES.length} websites
                  </span>
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      full.length === 0 ? "bg-red-500" : "bg-green-600",
                    )}
                    style={{ width: pct + "%" }}
                  />
                </div>

                <dl className="mt-3 space-y-2">
                  <SiteRow label="Supported" tone="green" items={full} />
                  {/* Renders only when it has members, so today's page shows
                      two rows and not an empty middle one. */}
                  {partial.length > 0 ? (
                    <SiteRow
                      label="Partial"
                      tone="amber"
                      items={partial}
                      showCount
                      outOf={table.rows.length}
                    />
                  ) : null}
                  <SiteRow label="Not available" tone="red" items={none} />
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* The detail, demoted: one card instead of two, smaller marks, no
          repeated platform header. It is still all forty answers. */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <div className="border-b bg-zinc-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Field by field
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
                    className="px-3 py-2 text-center text-xs font-medium"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <SiteIcon
                        icon={site.icon}
                        iconColor={site.iconColor}
                        className="h-3.5 w-3.5"
                      />
                      {site.label}
                    </span>
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
                        <td key={site.slug} className="px-3 py-1.5">
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
                              "mx-auto flex h-5 w-5 items-center justify-center rounded text-white",
                              yes ? "bg-green-600" : "bg-red-600",
                            )}
                          >
                            {yes ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
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

/** One line of the summary tile: a label and the websites in that bucket.
 *  Prints "None" rather than nothing, because a blank space beside
 *  "Not available" is ambiguous about whether it means zero or unknown. */
function SiteRow({
  label,
  tone,
  items,
  showCount = false,
  outOf,
}: {
  label: string;
  tone: "green" | "amber" | "red";
  items: { site: (typeof AUTOMATION_SITES)[number]; n: number }[];
  showCount?: boolean;
  outOf?: number;
}) {
  const dot =
    tone === "green"
      ? "bg-green-600"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-red-600";
  return (
    <div className="flex items-start gap-2">
      <dt className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-zinc-500">
        <span className={cn("block h-2 w-2 rounded-full", dot)} />
        {label}
      </dt>
      <dd className="min-w-0 flex-1">
        {items.length === 0 ? (
          <span className="text-xs text-zinc-400">None</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {items.map(({ site, n }) => (
              <span
                key={site.slug}
                className="inline-flex items-center gap-1 text-xs text-zinc-700"
              >
                <SiteIcon
                  icon={site.icon}
                  iconColor={site.iconColor}
                  className="h-3.5 w-3.5"
                />
                {site.label}
                {showCount ? (
                  <span className="tabular-nums text-zinc-400">
                    {n}/{outOf}
                  </span>
                ) : null}
              </span>
            ))}
          </span>
        )}
      </dd>
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
