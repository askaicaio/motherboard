// =============================================================
// Feature Integration "Alpha2", route /automations-feature-integration-alpha2
// =============================================================
// ✅✅ THIS LAYOUT SHIPPED TO THE LIVE PAGE ON 2026-09-30. The user, after
// comparing the eight: "the presentation here is good, pls implement it to the
// actual page." **So this bench is no longer a proposal; it is a record of
// what `/automations/feature-integration` now does**, and the paragraphs below
// are written in the past tense for that reason.
// 🛑 IT IS STILL NOT THE LIVE PAGE. The live one keeps the click-to-toggle
// machinery (optimistic write, POST, rollback) behind its `TOGGLE_ENABLED`
// flag; this bench never wrote and still does not. **If you are changing what
// a save does, you are editing the wrong file.**
// 📌 AND IT WAS NOT ARCHIVED FOR WINNING. Archiving is the user's call, and the
// other seven only stay meaningful while the one that won is beside them.
//
// ⭐ A LAYOUT BENCH FOR THE FEATURE INTEGRATION PAGE: **transposed, one row
// per website**. One of eight created together on 2026-09-29.
//
// 📌 WHAT IT ANSWERED. The live grid used to put the five websites across the
// top and the capabilities down the side. **That was the wrong way round for
// the question people actually bring here**, which is "what do we get out of
// GHL?" rather than "who supports Error Date?". Five rows is also a shorter
// table than eight, and a ROW has somewhere to put a summary: each website
// leads with its own coverage count and bar, which a column header cannot hold.
//
// ⚠️⚠️ THE COST WAS WIDTH, AND IT WAS PAID. Eight capability columns with
// readable headers need 1009px MEASURED, against the live page's old 722px
// floor. **The live floor moved to 1009 in the same change**, so its
// page-level scrollbar now appears below a 1312px window rather than 1025.
//
// ⚠️ THE MARKS ARE THE LIVE PAGE'S, reading the same stored state. ONLY THE
// LAYOUT DIFFERS, and nothing here writes.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Check, Rows3, X } from "lucide-react";
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

const SELF = "/automations-feature-integration-alpha2";

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

export default async function FeatureIntegrationAlpha2Page() {
  await requireAuth();
  const state = await getFeatureIntegrationMap();
  const on = (tableId: string, rowKey: string, slug: string) =>
    !!state[cellKey(tableId, rowKey, slug)];

  // Flattened column order, which is also the order the two-level header
  // describes. Keeping ONE list means the header spans and the body cells can
  // never disagree about which column is which.
  const columns = FEATURE_INTEGRATION_TABLES.flatMap((t) =>
    t.rows.map((r) => ({
      tableId: t.id,
      group: t.cornerLabel,
      rowKey: r.key,
      label: r.label,
    })),
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1009px] space-y-6 p-6">
        <Link
          href="/automations/feature-integration"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feature Integration
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <Rows3 className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Automations Feature Integration
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha2
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Transposed. One row per website, every capability across the top,
            and each row opens with what that website actually gives us.
          </p>
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              {/* Two-level header: the group row spans its own four columns, so
                  "Name and Link" can appear in both groups without ambiguity. */}
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th
                    rowSpan={2}
                    className="whitespace-nowrap border-b border-r px-3 py-2 text-left align-bottom font-semibold text-zinc-900"
                  >
                    Website
                  </th>
                  {FEATURE_INTEGRATION_TABLES.map((table) => (
                    <th
                      key={table.id}
                      colSpan={table.rows.length}
                      className="border-b border-l px-3 pb-1 pt-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {table.cornerLabel}
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="whitespace-nowrap border-b border-l px-3 py-2 text-right align-bottom font-medium"
                  >
                    Coverage
                  </th>
                </tr>
                <tr>
                  {columns.map((col, i) => (
                    <th
                      key={col.tableId + ":" + col.rowKey}
                      className={cn(
                        "whitespace-nowrap border-b px-3 pb-2 text-center text-xs font-medium",
                        // A left rule only where a group starts, so the two
                        // bands stay legible without striping every column.
                        i > 0 && col.tableId !== columns[i - 1].tableId
                          ? "border-l"
                          : "",
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AUTOMATION_SITES.map((site) => {
                  const hits = columns.filter((c) =>
                    on(c.tableId, c.rowKey, site.slug),
                  ).length;
                  const pct = Math.round((hits / columns.length) * 100);
                  return (
                    <tr key={site.slug} className="border-t">
                      <th
                        scope="row"
                        className="whitespace-nowrap border-r px-3 py-2 text-left font-medium text-zinc-900"
                      >
                        <span className="inline-flex items-center gap-2">
                          <SiteIcon
                            icon={site.icon}
                            iconColor={site.iconColor}
                            className="h-5 w-5"
                          />
                          {site.label}
                        </span>
                      </th>
                      {columns.map((col, i) => (
                        <td
                          key={col.tableId + ":" + col.rowKey}
                          className={cn(
                            "px-3 py-2 text-center",
                            i > 0 && col.tableId !== columns[i - 1].tableId
                              ? "border-l"
                              : "",
                          )}
                        >
                          <Mark
                            on={on(col.tableId, col.rowKey, site.slug)}
                            label={
                              col.label +
                              " for " +
                              site.label +
                              " (" +
                              col.group +
                              ")"
                            }
                          />
                        </td>
                      ))}
                      {/* ⭐ THE ROW SUMMARY IS WHY TRANSPOSING IS WORTH THE
                          WIDTH. A column header has nowhere to put this. */}
                      <td className="border-l px-3 py-2 text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                hits === 0 ? "bg-red-500" : "bg-green-600",
                              )}
                              style={{ width: pct + "%" }}
                            />
                          </span>
                          <span className="whitespace-nowrap text-xs tabular-nums text-zinc-500">
                            {hits} of {columns.length}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
