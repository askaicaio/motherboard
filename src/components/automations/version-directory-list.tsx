// The design-version directory: one dense line per version, grouped by
// experiment.
// =============================================================
// ⚠️ EXTRACTED FROM `automations/feature-integration/page.tsx` ON 2026-09-30,
// when the Design Versions page started rendering the same list, and **left in
// place hours later when that page became the ONLY one rendering it.**
// 📌 IT HAS ONE CONSUMER AGAIN, AND THAT IS FINE. A component with one caller
// is not dead code; folding it back into the page would be churn with no
// reader served. The extraction stopped being load-bearing, not useful.
// ⭐ ITS ONE CONSUMER IS `/automations/design-versions`, which is now the only
// route to every bench in the tab.
//
// ✅✅ THE LAYOUT CAME FROM Version Directory Alpha4, promoted 2026-09-30:
// "This layout is good, pls implement it". It replaced one card per family.
// 🛑🛑 IT IS NOT SHORTER THAN A GRID OF TILES AND NOBODY SHOULD CLAIM IT IS.
// Measured at a 1312px window: 35 tiles in a three-column grid need about
// 976px; these 35 rows plus their seven group strips need about 1162px, and
// the card measures 1369px. **A tile holds one version and three sit side by
// side, so per version a grid wins on height and always will.** What the list
// buys is a status word per row, a count per group, the archived ones inline,
// and columns that line up. Height was never the argument.
// =============================================================

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AUTOMATION_VERSIONS,
  versionGroupLabel,
  versionStatusKey,
  type AutomationVersion,
} from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

/** The status word on each row. **A dot and lowercase text, not a filled
 *  pill**: at one line per row a pill on all 35 would out-shout the names it
 *  is annotating. The registry hands over a key only; how loud each state
 *  looks is a rendering decision and it is made here. */
const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  live: { label: "live", dot: "bg-zinc-900", text: "text-zinc-900" },
  shipped: { label: "shipped", dot: "bg-green-600", text: "text-green-700" },
  parked: { label: "parked", dot: "bg-amber-500", text: "text-amber-700" },
  bench: { label: "bench", dot: "bg-blue-600", text: "text-blue-700" },
  archived: { label: "archived", dot: "bg-zinc-300", text: "text-zinc-400" },
};

/** Group order. ⚠️ **Not alphabetical and must not become so**: the live page
 *  belongs at the top, and the rest run oldest experiment to newest, which is
 *  the order they get reasoned about in. Any group the registry grows that is
 *  not named here still renders, at the end. */
const GROUP_ORDER = [
  "Live page",
  "Main Page",
  "Light / Dark Mode",
  "Dropdown Configuration",
  "Feature Integration",
  "Version Directory",
  "Toolbar Options",
];

/** ⚠️ GROUPED BY `versionGroupLabel`, NOT BY `family`. Several versions have no
 *  family at all (the Main Page betas and alphas, the toolbar gallery), so a
 *  `family` grouping would drop them; see that function's own note for why it
 *  is not simply a field. */
function groupVersions(versions: AutomationVersion[]) {
  const groups: { name: string; items: AutomationVersion[] }[] = [];
  for (const version of versions) {
    const name = versionGroupLabel(version);
    const found = groups.find((g) => g.name === name);
    if (found) found.items.push(version);
    else groups.push({ name, items: [version] });
  }
  groups.sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a.name);
    const ib = GROUP_ORDER.indexOf(b.name);
    return (
      (ia < 0 ? GROUP_ORDER.length : ia) - (ib < 0 ? GROUP_ORDER.length : ib)
    );
  });
  return groups;
}

export function VersionDirectoryList({
  heading = "Design Versions",
  versions = AUTOMATION_VERSIONS,
}: {
  /** The card's own heading. Defaults to the name the whole thing goes by. */
  heading?: string;
  /** Defaults to every registered version. Pass a subset to filter. */
  versions?: AutomationVersion[];
}) {
  const groups = groupVersions(versions);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2">
          <h2 className="text-sm font-semibold text-zinc-900">{heading}</h2>
          <span className="text-xs text-zinc-500">
            {versions.length} pages, each opens in a new tab
          </span>
        </div>

        {groups.map((group) => (
          <div key={group.name}>
            {/* A group heading costs one 24px strip. As a card per family it
                cost a card header, a subtitle and the gap above it, each. */}
            <div className="flex items-center justify-between gap-3 border-y bg-zinc-50/70 px-4 py-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {group.name}
              </h3>
              <span className="text-[11px] tabular-nums text-zinc-400">
                {group.items.length}
              </span>
            </div>
            {group.items.map((version) => {
              const tone = STATUS[versionStatusKey(version)];
              return (
                <Link
                  key={version.href}
                  href={version.href}
                  target="_blank"
                  rel="noreferrer"
                  prefetch={false}
                  className="group flex items-center gap-3 px-4 py-1.5 transition-colors hover:bg-zinc-50"
                >
                  <version.icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span className="w-52 shrink-0 truncate text-sm font-medium text-zinc-900">
                    {version.label}
                  </span>
                  <span className="inline-flex w-20 shrink-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "block h-1.5 w-1.5 shrink-0 rounded-full",
                        tone.dot,
                      )}
                    />
                    <span className={cn("text-[11px]", tone.text)}>
                      {tone.label}
                    </span>
                  </span>
                  {/* 🛑 `truncate`, NOT `line-clamp-1`. A clamp has to own
                      `display`, and this is a flex child that already has one;
                      see the line-clamp note in memory. One line either way,
                      and truncate cannot be silently killed by a utility
                      emitted after it.
                      ⚠️ IT IS ALSO WHY A HOST PAGE'S FLOOR NEED NOT BE WIDE: a
                      nowrap child reports its whole text as min-content, so
                      this list "measures" about 1017px and works at far less.
                      Measured at a 1009px floor the blurb sits at 567px. */}
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                    {version.blurb}
                  </span>
                  {version.shipped ? (
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-green-700">
                      runs {version.shipped.label}
                    </span>
                  ) : null}
                  <ExternalLink className="h-3 w-3 shrink-0 text-zinc-200 transition-colors group-hover:text-zinc-500" />
                </Link>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
