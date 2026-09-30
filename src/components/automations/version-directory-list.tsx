"use client";

// The design-version directory: one dense line per version, grouped by
// experiment, with a clickable status.
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
// ⚠️⚠️ IT BECAME A CLIENT COMPONENT ON 2026-09-30, when the user asked for the
// status to be editable: "something like clicking the status and a dropdown
// shows up". Nothing else about it changed. The writes go to
// `/api/automations/version-status`; see `version-status.ts` for where the
// answers are kept and why the registry could not hold them.
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
//
// 🛑 THE ROW STOPPED BEING ONE BIG LINK when the status became a button.
// **A `<button>` inside an `<a>` is invalid HTML and the click would navigate
// instead of opening the menu.** So the link is now the icon and the name,
// exactly as `version-tile.tsx` does it, and the blurb is plain text.
// ⚠️ Clicking a description used to open the page and no longer does. That is
// the price of the menu, not an oversight.
// =============================================================

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown, ExternalLink, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AUTOMATION_VERSIONS,
  EDITABLE_VERSION_STATUSES,
  versionGroupLabel,
  versionStatusKey,
  type AutomationVersion,
  type VersionStatusKey,
} from "@/lib/automations/versions";
import { cn } from "@/lib/utils";

/** The status word on each row. **A dot and lowercase text, not a filled
 *  pill**: at one line per row a pill on all 35 would out-shout the names it
 *  is annotating. The registry hands over a key only; how loud each state
 *  looks is a rendering decision and it is made here. */
const STATUS: Record<
  VersionStatusKey,
  { label: string; dot: string; text: string; blurb: string }
> = {
  live: {
    label: "live",
    dot: "bg-zinc-900",
    text: "text-zinc-900",
    blurb: "This row is the live page itself.",
  },
  shipped: {
    label: "shipped",
    dot: "bg-green-600",
    text: "text-green-700",
    blurb: "Its layout is what a live page renders.",
  },
  parked: {
    label: "parked",
    dot: "bg-amber-500",
    text: "text-amber-700",
    blurb: "Finished. The next move belongs to the business.",
  },
  bench: {
    label: "bench",
    dot: "bg-blue-600",
    text: "text-blue-700",
    blurb: "Still being compared. The next move is ours.",
  },
  archived: {
    label: "archived",
    dot: "bg-zinc-300",
    text: "text-zinc-400",
    blurb: "The question it was asking is settled.",
  },
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
  initialOverrides = {},
}: {
  /** The card's own heading. Defaults to the name the whole thing goes by. */
  heading?: string;
  /** Defaults to every registered version. Pass a subset to filter. */
  versions?: AutomationVersion[];
  /** Stored status overrides, href -> status. An absent href means the
   *  registry's own answer, so the code stays the default. */
  initialOverrides?: Record<string, VersionStatusKey>;
}) {
  const groups = groupVersions(versions);
  const [overrides, setOverrides] =
    useState<Record<string, VersionStatusKey>>(initialOverrides);
  // Hrefs with a save in flight. Their menu is disabled, so a second click
  // cannot race the first.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const setStatus = async (href: string, status: VersionStatusKey | null) => {
    if (pending.has(href)) return;
    const before = overrides[href];

    // Optimistic, then reconcile with the server's canonical map so a change
    // someone else made in between is not lost. Same shape as the Feature
    // Integration checklist, which writes to app_settings the same way.
    setOverrides((prev) => {
      const next = { ...prev };
      if (status === null) delete next[href];
      else next[href] = status;
      return next;
    });
    setPending((prev) => new Set(prev).add(href));

    try {
      const res = await fetch("/api/automations/version-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ href, status }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => null);
      if (data?.overrides) setOverrides(data.overrides);
    } catch {
      setOverrides((prev) => {
        const next = { ...prev };
        if (before === undefined) delete next[href];
        else next[href] = before;
        return next;
      });
      toast.error("Couldn't save that status. Please try again.");
    } finally {
      setPending((prev) => {
        const copy = new Set(prev);
        copy.delete(href);
        return copy;
      });
    }
  };

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
              const derived = versionStatusKey(version);
              const override = overrides[version.href];
              const current = override ?? derived;
              const tone = STATUS[current];
              return (
                <div
                  key={version.href}
                  className="group flex items-center gap-3 px-4 py-1.5 transition-colors hover:bg-zinc-50"
                >
                  <Link
                    href={version.href}
                    target="_blank"
                    rel="noreferrer"
                    prefetch={false}
                    className="inline-flex w-52 shrink-0 items-center gap-1.5"
                  >
                    <version.icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate text-sm font-medium text-zinc-900 underline-offset-2 hover:underline">
                      {version.label}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-zinc-200 transition-colors group-hover:text-zinc-500" />
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={pending.has(version.href)}
                      aria-label={`Status of ${version.label}: ${tone.label}. Change it.`}
                      className="inline-flex w-[104px] shrink-0 items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-zinc-200/60 disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          "block h-1.5 w-1.5 shrink-0 rounded-full",
                          tone.dot,
                        )}
                      />
                      <span className={cn("text-[11px]", tone.text)}>
                        {tone.label}
                      </span>
                      {/* ⚠️ THE CHEVRON IS THE ONLY THING SAYING THIS IS
                          CLICKABLE, and it is invisible until the row is
                          hovered. **A permanent chevron on all 35 rows would
                          be the loudest thing on the page**, which is the
                          opposite of what a dot-and-word status is for. */}
                      <ChevronDown className="h-3 w-3 shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72">
                      {EDITABLE_VERSION_STATUSES.map((key) => {
                        const option = STATUS[key];
                        return (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => setStatus(version.href, key)}
                          >
                            <span
                              className={cn(
                                "block h-1.5 w-1.5 shrink-0 rounded-full",
                                option.dot,
                              )}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-sm">{option.label}</span>
                              {/* The one-liner is what makes these
                                  distinguishable. "parked" and "archived" are
                                  opposites and the words do not say so. */}
                              <span className="text-[11px] text-zinc-500">
                                {option.blurb}
                              </span>
                            </span>
                            {current === key ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                            ) : null}
                          </DropdownMenuItem>
                        );
                      })}
                      {/* Shown only when there is something to undo, so the
                          menu does not carry a permanently dead item. */}
                      {override ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setStatus(version.href, null)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-sm">Reset to default</span>
                              <span className="text-[11px] text-zinc-500">
                                Back to {STATUS[derived].label}, what the code
                                says.
                              </span>
                            </span>
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>

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
                  {/* ⚠️ THE "runs" TAIL IS NOT THE STATUS AND DOES NOT MOVE
                      WITH IT. It comes from `shipped` in the registry, so a
                      row hand-set to "archived" still says what it runs, which
                      is a combination two versions are genuinely in. */}
                  {version.shipped ? (
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-green-700">
                      runs {version.shipped.label}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
