// =============================================================
// Version Directory "Alpha4", route /automations-version-directory-alpha4
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE VERSION DIRECTORY: **dense rows, one card**. One
// of six created together on 2026-09-30.
//
// 📌 WHAT IT ANSWERS. It keeps today's grouping (by experiment) and argues
// only about SIZE. A tile is a two-line box with its own ring, 8px of gap and
// 20px of padding; **twenty-eight of them is a page you scroll rather than a
// list you read.** The same twenty-eight as single lines fit in roughly a
// third of the height, with the blurb still on the line and a status pill
// added, not removed.
//
// ⚠️⚠️ THE BLURB IS TRUNCATED TO ONE LINE AND THAT IS THE TRADE. On a tile it
// wraps to two. **If the blurbs turn out to be the thing you actually read,
// this is the wrong bench and Alpha1 is the right one**, because a table cell
// can be as tall as it likes. Worth knowing before picking on looks.
//
// 📊 WHY THE FLOOR IS 720px AND NOT THE 1017px THIS PAGE MEASURES. 1017 is its
// min-content, but **min-content is not the breaking point for a list that
// truncates** - it is the width at which nothing is abbreviated, because a
// `truncate` child is `white-space: nowrap` and contributes its whole text to
// the container size even with `min-w-0`. Measured at the 720 floor: the blurb
// shrinks to 139px and ellipsises, and **nothing else clips or moves.** So the
// floor is a judgement about how much abbreviation is acceptable, not a
// measurement. ⚠️ Do not "correct" it to 1017.
//
// ⚠️ IT IS A BENCH. The live page's cards are untouched.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { AlignJustify, ArrowLeft, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AUTOMATION_VERSIONS,
  versionGroupLabel,
  versionStatusKey,
} from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Just a dot and a word here: at this density a filled pill on every row
 *  would out-shout the names. */
const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  live: { label: "live", dot: "bg-zinc-900", text: "text-zinc-900" },
  shipped: { label: "shipped", dot: "bg-green-600", text: "text-green-700" },
  parked: { label: "parked", dot: "bg-amber-500", text: "text-amber-700" },
  bench: { label: "bench", dot: "bg-blue-600", text: "text-blue-700" },
  archived: { label: "archived", dot: "bg-zinc-300", text: "text-zinc-400" },
};

const ORDER = [
  "Live page",
  "Main Page",
  "Light / Dark Mode",
  "Dropdown Configuration",
  "Feature Integration",
  "Version Directory",
  "Toolbar Options",
];

export default async function VersionDirectoryAlpha4Page() {
  await requireAuth();

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

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px] space-y-6 p-6">
        <Link
          href="/automations/feature-integration"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feature Integration
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <AlignJustify className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Design Versions
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha4
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            The same grouping as today, one line per version instead of a tile.
            Everything on one card, including the archive.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2">
              <h2 className="text-sm font-semibold text-zinc-900">
                Every version
              </h2>
              <span className="text-xs text-zinc-500">
                {AUTOMATION_VERSIONS.length} pages, each opens in a new tab
              </span>
            </div>

            {groups.map((g) => (
              <div key={g.name}>
                {/* A group heading costs one 24px strip, where today it costs
                    a whole card header plus the gap above it. */}
                <div className="flex items-center justify-between gap-3 border-y bg-zinc-50/70 px-4 py-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {g.name}
                  </h3>
                  <span className="text-[11px] tabular-nums text-zinc-400">
                    {g.items.length}
                  </span>
                </div>
                {g.items.map((v) => {
                  const tone = STATUS[versionStatusKey(v)];
                  return (
                    <Link
                      key={v.href}
                      href={v.href}
                      target="_blank"
                      rel="noreferrer"
                      prefetch={false}
                      className="group flex items-center gap-3 px-4 py-1.5 transition-colors hover:bg-zinc-50"
                    >
                      <v.icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span className="w-52 shrink-0 truncate text-sm font-medium text-zinc-900">
                        {v.label}
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
                      {/* 🛑 `truncate`, NOT `line-clamp-1`. A clamp needs to
                          own `display`, and this element is a flex child that
                          already has one; see the line-clamp note in memory.
                          One line either way, and truncate cannot be broken
                          by a utility landing after it. */}
                      <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                        {v.blurb}
                      </span>
                      {v.shipped ? (
                        <span className="shrink-0 whitespace-nowrap text-[11px] text-green-700">
                          runs {v.shipped.label}
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
      </div>
    </div>
  );
}
