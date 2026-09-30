// =============================================================
// Version Directory "Alpha2", route /automations-version-directory-alpha2
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE VERSION DIRECTORY: **grouped by status, not by
// family**. One of six created together on 2026-09-30.
//
// 📌 WHAT IT ANSWERS. The cards today group by WHAT a design redesigns, which
// is how they were built but not how they are read. **The question a directory
// gets asked is "what still needs me"**, and the registry already knows: three
// designs shipped, three are parked waiting on the business, seventeen are
// settled, and the rest are open. Grouping on that turns a catalogue into a
// state of play, and puts the seventeen archived ones last instead of on a
// different page.
//
// ⚠️⚠️ A DESIGN THAT IS BOTH SHIPPED AND ARCHIVED GOES IN "IN USE", NOT
// "SETTLED". Two of the three shipped ones are also archived, because winning
// is what finishes a bench. **Both facts are true and the page says both**, but
// "the live page runs this layout" is the one worth leading with, so the
// archived note rides along in grey rather than moving the row.
//
// ⚠️ IT IS A BENCH. The live page's cards are untouched.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, ExternalLink, Signpost } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AUTOMATION_VERSIONS,
  versionGroupLabel,
  versionStatusKey,
  type AutomationVersion,
} from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The sections, in the order they deserve attention. **The wording is the
 *  whole design**: "Waiting on you" says more than "Parked", and "Settled"
 *  says more than "Archived", because a status name should answer "so what". */
const SECTIONS: {
  key: string;
  title: string;
  blurb: string;
  keys: string[];
  tone: string;
}[] = [
  {
    key: "in-use",
    title: "In use",
    blurb:
      "The live page, plus every design whose layout a real page now renders.",
    keys: ["live", "shipped"],
    tone: "bg-green-600",
  },
  {
    key: "waiting",
    title: "Waiting on a decision",
    blurb: "Finished and working. The next move belongs to the business.",
    keys: ["parked"],
    tone: "bg-amber-500",
  },
  {
    key: "open",
    title: "Open questions",
    blurb: "Still being compared. The next move is ours.",
    keys: ["bench"],
    tone: "bg-blue-600",
  },
  {
    key: "settled",
    title: "Settled",
    blurb:
      "The question these were asking is answered. They still work and still open.",
    keys: ["archived"],
    tone: "bg-zinc-400",
  },
];

function VersionRow({ v }: { v: AutomationVersion }) {
  return (
    <Link
      href={v.href}
      target="_blank"
      rel="noreferrer"
      prefetch={false}
      className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
    >
      <v.icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-zinc-900">{v.label}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
          {/* The experiment name, which a status-first grouping would
              otherwise throw away entirely. */}
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            {versionGroupLabel(v)}
          </span>
          {v.shipped ? (
            <span className="text-[11px] text-green-700">
              runs {v.shipped.label}
            </span>
          ) : null}
          {v.shipped && v.archived ? (
            <span className="text-[11px] text-zinc-400">also archived</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500">{v.blurb}</span>
      </span>
    </Link>
  );
}

export default async function VersionDirectoryAlpha2Page() {
  await requireAuth();

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: AUTOMATION_VERSIONS.filter((v) =>
      section.keys.includes(versionStatusKey(v)),
    ),
  }));

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
          <Signpost className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Design Versions
          </h1>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Alpha2
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Grouped by where each version stands rather than by what it redesigns.
          What needs you is at the top; what is settled is at the bottom.
        </p>
      </div>

      {sections.map((section) => (
        // A section with no members still renders, unlike the live page's
        // empty cards: here the absence is the information ("nothing is
        // waiting on you"), because the heading is a question about state.
        <Card key={section.key}>
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-3 border-b bg-zinc-50 px-4 py-2.5">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <span
                    className={cn(
                      "block h-2 w-2 shrink-0 rounded-full",
                      section.tone,
                    )}
                  />
                  {section.title}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">{section.blurb}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                {section.items.length}
              </span>
            </div>
            {section.items.length === 0 ? (
              <p className="px-4 py-4 text-sm text-zinc-500">
                Nothing here right now.
              </p>
            ) : (
              <div className="divide-y">
                {section.items.map((v) => (
                  <VersionRow key={v.href} v={v} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
