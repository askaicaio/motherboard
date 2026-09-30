// =============================================================
// Version Directory "Alpha6", route /automations-version-directory-alpha6
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE VERSION DIRECTORY: **provenance first**. One of
// six created together on 2026-09-30.
//
// 📌 WHAT IT ANSWERS, AND IT IS THE ONE THING NO TILE SAYS. Three of these
// designs are not proposals any more: the Automations hub runs Main Page
// Beta2, Dropdown Configuration runs Dropdown Config Alpha1, and Feature
// Integration runs Feature Integration Alpha2. **That fact currently exists
// only in code comments and in the Done List**, so the directory presents a
// winner and the seven it beat as twenty-eight interchangeable tiles.
// Leading with it turns the page from a catalogue into a record of what the
// app is made of, and makes "why does this page look like that" answerable by
// clicking.
//
// ⚠️⚠️ TWO OF THE THREE WINNERS ARE ALSO ARCHIVED, which looks like a
// contradiction and is not: winning is what FINISHES a bench. The page says
// both rather than choosing.
//
// ⚠️ IF NOTHING HAD SHIPPED, the top section would be empty and this layout
// would have nothing to lead with. It renders an honest line in that case
// instead of an empty box, but **the design does depend on promotions
// happening**, which is worth knowing before picking it.
//
// ⚠️ IT IS A BENCH. The live page's cards are untouched.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, ArrowRight, ExternalLink, Route } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AUTOMATION_VERSIONS,
  versionGroupLabel,
  versionStatusKey,
} from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ORDER = [
  "Live page",
  "Main Page",
  "Light / Dark Mode",
  "Dropdown Configuration",
  "Feature Integration",
  "Version Directory",
  "Toolbar Options",
];

const REST_TONE: Record<string, string> = {
  live: "text-zinc-900",
  shipped: "text-green-700",
  parked: "text-amber-700",
  bench: "text-blue-700",
  archived: "text-zinc-400",
};

export default async function VersionDirectoryAlpha6Page() {
  await requireAuth();

  const shipped = AUTOMATION_VERSIONS.filter((v) => v.shipped);
  const rest = AUTOMATION_VERSIONS.filter((v) => !v.shipped);

  const groups: { name: string; items: typeof AUTOMATION_VERSIONS }[] = [];
  for (const v of rest) {
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
          <Route className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Design Versions
          </h1>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Alpha6
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          What the live pages are actually running, first. The experiments that
          have not been picked come after.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Running in the app
            </h2>
            <span className="text-xs text-zinc-500">
              {shipped.length} of {AUTOMATION_VERSIONS.length} designs
            </span>
          </div>

          {shipped.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">
              No design has been promoted to a live page yet. Every version
              below is still a proposal.
            </p>
          ) : (
            <div className="divide-y">
              {shipped.map((v) => (
                <div
                  key={v.href}
                  className="flex flex-col gap-2 px-4 py-3 @min-[640px]:flex-row @min-[640px]:items-center @min-[640px]:gap-4"
                >
                  {/* The DESTINATION reads first, because the question is
                      "what is this page made of", not "where did this bench
                      go". Same tab: it is a real page, not an experiment. */}
                  <Link
                    href={v.shipped!.href}
                    className="group shrink-0 @min-[640px]:w-56"
                  >
                    <span className="block text-sm font-semibold text-zinc-900 underline-offset-2 group-hover:underline">
                      {v.shipped!.label}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {v.shipped!.href}
                    </span>
                  </Link>

                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-zinc-300 @min-[640px]:block" />

                  <Link
                    href={v.href}
                    target="_blank"
                    rel="noreferrer"
                    prefetch={false}
                    className="group min-w-0 flex-1"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <v.icon className="h-4 w-4 shrink-0 text-zinc-500" />
                      <span className="text-sm font-medium text-zinc-900 underline-offset-2 group-hover:underline">
                        {v.label}
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
                      {v.archived ? (
                        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                          archived
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {v.blurb}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-900">
                Not picked
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Still open, waiting on a decision, or settled without being
                used. All of them still work.
              </p>
            </div>
            <span className="shrink-0 text-xs text-zinc-500">
              {rest.length} pages, each opens in a new tab
            </span>
          </div>

          {groups.map((g) => (
            <div key={g.name}>
              <div className="border-y bg-zinc-50/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {g.name}
              </div>
              <div className="flex flex-wrap gap-1.5 p-3">
                {g.items.map((v) => (
                  <Link
                    key={v.href}
                    href={v.href}
                    target="_blank"
                    rel="noreferrer"
                    prefetch={false}
                    title={v.blurb}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50",
                      REST_TONE[versionStatusKey(v)],
                    )}
                  >
                    <v.icon className="h-3.5 w-3.5 shrink-0" />
                    {v.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
