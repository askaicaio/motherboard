// =============================================================
// Version Directory "Alpha1", route /automations-version-directory-alpha1
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE VERSION DIRECTORY: **one table, every version**.
// One of six created together on 2026-09-30, after the user circled the
// "Feature Integration Layouts" card: "Any suggestions on how to show these
// layouts differently? pls make Alpha pages for them".
//
// 📌 WHAT IT ANSWERS. The directory is currently **one card per family**, and
// there are four families, so there are four cards, and a fifth page for the
// archive. Every family added is another card, and **the archived ones are not
// even on the same page**, so comparing a retired design with a live one means
// two tabs. One table holds all of it, sorts, and has columns for the two
// things a tile cannot show: which experiment a version belongs to, and
// whether its layout actually shipped.
//
// ⭐ IT LISTS ITS OWN SIBLINGS, which is why there is no "other layouts" strip
// at the bottom like the Feature Integration benches carry. **A directory that
// could not reach the other directories would be failing at its own job.**
//
// ⚠️ IT IS A BENCH. The live page's cards are untouched.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, ExternalLink, Table2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AUTOMATION_VERSIONS,
  versionGroupLabel,
  versionStatusKey,
} from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The five states, with the wording and the colour that belong to THIS page.
 *  ⚠️ The registry hands over a key only; how loud each state looks is a
 *  layout decision and each of the six benches makes it differently. */
const STATUS: Record<string, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-zinc-900 text-white" },
  shipped: { label: "Shipped", className: "bg-green-100 text-green-800" },
  parked: { label: "Parked", className: "bg-amber-100 text-amber-800" },
  bench: { label: "Bench", className: "bg-blue-100 text-blue-800" },
  archived: { label: "Archived", className: "bg-zinc-200 text-zinc-600" },
};

/** Experiment order, then the registry's own order inside it. **Sorting by
 *  name would interleave the families**, which is the one thing the current
 *  cards get right and a flat table could easily lose. */
const GROUP_ORDER = [
  "Live page",
  "Main Page",
  "Light / Dark Mode",
  "Dropdown Configuration",
  "Feature Integration",
  "Version Directory",
  "Toolbar Options",
];

export default async function VersionDirectoryAlpha1Page() {
  await requireAuth();

  const rows = AUTOMATION_VERSIONS.map((v, index) => ({
    v,
    group: versionGroupLabel(v),
    status: versionStatusKey(v),
    index,
  })).sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group);
    const gb = GROUP_ORDER.indexOf(b.group);
    if (ga !== gb) return ga - gb;
    return a.index - b.index;
  });

  const shipped = rows.filter((r) => r.v.shipped).length;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[892px] space-y-6 p-6">
        <Link
          href="/automations/feature-integration"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feature Integration
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Table2 className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Design Versions
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha1
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            One table for every version, archived ones included. Each row says
            which experiment it belongs to and whether its layout shipped.
          </p>
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
              <h2 className="text-sm font-semibold text-zinc-900">
                All versions
              </h2>
              <span className="text-xs text-zinc-500">
                {rows.length} pages, {shipped} of them shipped, each opens in a
                new tab
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium">
                    Version
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium">
                    Experiment
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium">
                    What it tries
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ v, group, status }) => {
                  const tone = STATUS[status];
                  return (
                    <tr
                      key={v.href}
                      className="border-t transition-colors hover:bg-zinc-50"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {/* The whole row is not a link, on purpose: a row that
                            navigates makes the text impossible to select, and
                            these blurbs are the part people compare. */}
                        <Link
                          href={v.href}
                          target="_blank"
                          rel="noreferrer"
                          prefetch={false}
                          className="group inline-flex items-center gap-2 font-medium text-zinc-900"
                        >
                          <v.icon className="h-4 w-4 shrink-0 text-zinc-500" />
                          <span className="underline-offset-2 group-hover:underline">
                            {v.label}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                        {group}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            tone.className,
                          )}
                        >
                          {tone.label}
                        </span>
                        {/* ⚠️ SHIPPED AND ARCHIVED ARE BOTH TRUE for two of
                            these. The pill picks the more useful one and this
                            line carries the rest, rather than dropping it. */}
                        {v.shipped ? (
                          <span className="ml-2 text-xs text-zinc-500">
                            to {v.shipped.label}
                          </span>
                        ) : null}
                        {v.shipped && v.archived ? (
                          <span className="ml-2 text-xs text-zinc-400">
                            (archived)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{v.blurb}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
