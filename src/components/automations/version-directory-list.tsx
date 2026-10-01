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
    blurb: "The live page.",
  },
  shipped: {
    label: "shipped",
    dot: "bg-green-600",
    text: "text-green-700",
    blurb: "Layout in use by a live page.",
  },
  parked: {
    label: "parked",
    dot: "bg-amber-500",
    text: "text-amber-700",
    blurb: "Complete. Awaiting a business decision.",
  },
  bench: {
    label: "bench",
    dot: "bg-blue-600",
    text: "text-blue-700",
    blurb: "Open experiment. Under comparison.",
  },
  archived: {
    label: "archived",
    dot: "bg-zinc-300",
    text: "text-zinc-400",
    blurb: "Closed. Retained for reference.",
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
  versions = AUTOMATION_VERSIONS,
  initialOverrides = {},
}: {
  /** Defaults to every registered version. Pass a subset to filter. */
  versions?: AutomationVersion[];
  /** Stored status overrides, href -> status. An absent href means the
   *  registry's own answer, so the code stays the default. */
  initialOverrides?: Record<string, VersionStatusKey>;
}) {
  const groups = groupVersions(versions);

  // ⭐ THE DEFAULT IS THE BIGGEST EXPERIMENT, NOT THE FIRST ROW. "Live page"
  // is first and holds exactly one version, so landing there would make the
  // rail look like it leads nowhere. **The rail prints every count anyway**,
  // so nothing is hidden by opening on the fullest one.
  const widest = groups.reduce(
    (best, g) => (g.items.length > best.items.length ? g : best),
    groups[0],
  );
  const [active, setActive] = useState<string>(widest.name);
  const current = groups.find((g) => g.name === active) ?? groups[0];
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
    /* ⭐⭐ A RAIL OF EXPERIMENTS BESIDE THE TABLE, 2026-09-30, promoted from
       Version Directory Alpha3: "Implement these side tabs from the alpha
       while keeping the current table layout."
       📌 THE TABLE IS UNCHANGED. Same columns, same dense rows, same status
       menu; **only the group strips went, because with a rail there is one
       group on screen and the card header names it.**
       ⭐ WHY A RAIL AT ALL: the directory used to grow DOWNWARD by card, one
       per experiment. A rail grows by a row in a 240px column instead, so a
       new experiment costs nothing vertical. Same argument that put a rail on
       the Dropdown Configuration page on 2026-09-25.
       ⚠️⚠️ WHAT IT COSTS, AND IT IS A REAL TRADE: a table sizes its columns to
       the widest cell IT CONTAINS, so with one experiment rendered the name
       column is as wide as that experiment's longest name. **Switching rails
       shifts the status column a little** - Feature Integration's names are
       ~60px longer than Main Page's. Each view is internally aligned, which
       is what the column widths were for; a fixed width would freeze them at
       the cost of the magic number that was just removed. */
    <div className="flex items-start gap-4">
      <nav aria-label="Design experiments" className="w-60 shrink-0 space-y-1">
        {groups.map((group) => {
          const on = group.name === current.name;
          return (
            <button
              key={group.name}
              type="button"
              onClick={() => setActive(group.name)}
              aria-current={on ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                on
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 ring-1 ring-foreground/10 hover:bg-zinc-50",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {group.name}
              </span>
              {/* Every count is on screen at once, which is what lets the
                  panel show one group without hiding the shape of the rest. */}
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  on ? "bg-white/15 text-white" : "bg-zinc-200 text-zinc-700",
                )}
              >
                {group.items.length}
              </span>
            </button>
          );
        })}
      </nav>

      <Card className="min-w-0 flex-1">
        <CardContent className="overflow-x-auto p-0">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              {current.name}
            </h2>
            <span className="text-xs text-zinc-500">
              {current.items.length} pages, each opens in a new tab
            </span>
          </div>

          {/* ⭐⭐ A REAL TABLE SINCE 2026-09-30, NOT FLEX ROWS. The user: "can you
            make the width of this column flexible, since the titles don't
            fit". The name column was `w-52`, so "Feature Integration Alpha1"
            truncated to "Feature Integration Alph...".
            🛑🛑 THE OBVIOUS FIX IS THE WRONG ONE. Letting each name size to its
            own content (`w-auto`) makes every row a different width, and
            **columns that line up is one of the two reasons this layout was
            picked over tiles.** Widening the fixed number fixes today and
            breaks again the next time a longer name is registered, which in
            this file is roughly weekly.
            ⭐ A TABLE SIZES A COLUMN TO THE WIDEST CELL IN IT, across every
            row, for free. That is the actual request: flexible AND aligned.
            📌 IT ALSO RETIRED TWO MAGIC NUMBERS, the 208px name column and the
            104px status column. Nothing here sets a column width now. */}
          <table className="w-full text-sm">
            <tbody>
              {current.items.map((version) => {
                const derived = versionStatusKey(version);
                const override = overrides[version.href];
                const current = override ?? derived;
                const tone = STATUS[current];
                return (
                  <tr
                    key={version.href}
                    className="group transition-colors hover:bg-zinc-50"
                  >
                    {/* ⚠️ `font-medium` IS LOAD-BEARING ON A `th`: the UA
                        default is bold and Tailwind v4 does not reset it, so
                        without this the names would come out heavier than they
                        were as divs. Same for `text-left`, which undoes the
                        UA centring. */}
                    <th
                      scope="row"
                      className="whitespace-nowrap py-1.5 pl-4 pr-3 text-left font-medium"
                    >
                      <Link
                        href={version.href}
                        target="_blank"
                        rel="noreferrer"
                        prefetch={false}
                        className="inline-flex items-center gap-1.5"
                      >
                        <version.icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline">
                          {version.label}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-zinc-200 transition-colors group-hover:text-zinc-500" />
                      </Link>
                    </th>

                    <td className="whitespace-nowrap px-3 py-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={pending.has(version.href)}
                          aria-label={`Status of ${version.label}: ${tone.label}. Change it.`}
                          className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-zinc-200/60 disabled:opacity-50"
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
                              hovered. **A permanent chevron on all 35 rows
                              would be the loudest thing on the page**, which
                              is the opposite of what a dot-and-word status is
                              for. */}
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
                                  <span className="text-sm">
                                    {option.label}
                                  </span>
                                  {/* The one-liner is what makes these
                                      distinguishable. "parked" and "archived"
                                      are opposites and the words do not say
                                      so.
                                      ⚠️ WRITTEN IN A SYSTEM VOICE since
                                      2026-09-30: "make the descriptions more
                                      system-like". **They were narrating
                                      ("the next move is ours") where a status
                                      definition should just define.** Keep
                                      them as terse fragments with no narrator
                                      and no "we". */}
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
                          {/* Shown only when there is something to undo, so
                              the menu does not carry a permanently dead
                              item. */}
                          {override ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setStatus(version.href, null)}
                              >
                                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="text-sm">
                                    Reset to default
                                  </span>
                                  <span className="text-[11px] text-zinc-500">
                                    Back to {STATUS[derived].label}, what the
                                    code says.
                                  </span>
                                </span>
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>

                    {/* 🛑🛑 THIS DESCRIPTION WRAPS AND MUST NOT GO BACK TO
                        `truncate`, 2026-10-01. The user, on a narrow window:
                        "This page has a bug with narrowing where the text
                        can't be read due to being constrained." It was
                        `w-full max-w-0` + `truncate`, which cut the
                        description to about twenty characters once the rail
                        took its 256px.
                        ⚠️⚠️ I HAD CALLED THAT TRADE THE RIGHT WAY ROUND AND IT
                        WAS NOT. The floor note on the page said "revisit if
                        the descriptions turn out to be what people read
                        here"; they are. **A column that holds the only
                        sentence explaining what a version IS cannot be the
                        one that gives way.**
                        ⭐ WRAPPING COSTS NOTHING AT FULL WIDTH, where every
                        blurb still sits on one line, and at a narrow window a
                        row grows to two lines instead of hiding its content.
                        **A taller row is readable; a shorter one is not.**
                        📌 `w-full` WITHOUT `max-w-0` NOW. The zero max-width
                        existed only to give `truncate` something to ellipsis
                        against; wrapping text shrinks on its own, so the cell
                        still takes what is left and the table can still get
                        narrow.
                        🛑🛑 `[overflow-wrap:anywhere]` WAS TRIED HERE AND
                        REMOVED, WHICH IS THE OPPOSITE OF THE HOUSE RULE. It
                        is normally the right fix for a long token stretching
                        a column. **In a table cell it does the reverse
                        damage: it lets the column shrink to ONE CHARACTER,
                        because the longest word stops being a floor.**
                        Measured at an 800px box: the description went to 11px
                        wide and 45 lines tall, in a 732px row. Without it the
                        longest word is the minimum and the column cannot
                        collapse. ⚠️ If a blurb ever does carry a long token,
                        the card scrolls, which is the better failure. */}
                    <td className="w-full px-3 py-1.5">
                      <span className="block text-xs text-zinc-500">
                        {version.blurb}
                      </span>
                    </td>

                    {/* ⚠️ THE "runs" TAIL IS NOT THE STATUS AND DOES NOT MOVE
                        WITH IT. It comes from `shipped` in the registry, so a
                        row hand-set to "archived" still says what it runs,
                        which is a combination two versions are genuinely
                        in. */}
                    <td className="whitespace-nowrap py-1.5 pl-3 pr-4 text-right">
                      {version.shipped ? (
                        <span className="text-[11px] text-green-700">
                          runs {version.shipped.label}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
