// Automations Feature Integration page. Reached from the encircled "?" icon
// next to the "Automations" title on the Main Page. Documents which Motherboard
// app features each website's API integration unlocks.
//
// This is a LITERAL route segment (`feature-integration`), so it takes
// precedence over the sibling `[platform]` dynamic route for this exact path.
//
// Shows two checklist tables (Refresh List + Error Tracking) with the
// automation websites as columns; each cell is a saved red/green checkbox.

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { Archive, ArrowLeft, ExternalLink } from "lucide-react";
import { FeatureIntegrationTables } from "@/components/automations/feature-integration-tables";
import { getFeatureIntegrationMap } from "@/lib/automations/feature-integration";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_VERSIONS,
  versionGroupLabel,
  versionStatusKey,
} from "@/lib/automations/versions";

/* ✅✅ THE DIRECTORY IS ONE DENSE LIST AS OF 2026-09-30, promoted from Version
 * Directory Alpha4. The user, after comparing six: "This layout is good, pls
 * implement it".
 * 🛑🛑 IT REPLACED FOUR CARDS AND A VersionTile GRID. There used to be one
 * card per family (benches, light/dark, dropdown config, feature integration,
 * version directory), each with its own heading, its own count and its own
 * length guard, and **every family added was another card**. This is one card
 * with a 24px strip per group.
 * ⭐ IT ALSO SHOWS THE ARCHIVED VERSIONS INLINE, which the cards could not: all
 * five of those lists filtered the archived ones out precisely so a version
 * could not render twice. One list has nowhere to render twice.
 * 🛑🛑 IT IS NOT SHORTER THAN A GRID OF TILES AND NOBODY SHOULD CLAIM IT IS.
 * Measured at a 1312px window: 35 tiles in the three-column grid this page
 * used to run need about 976px; these 35 rows plus their seven group strips
 * need about 1162px, and the card measures 1369px. **A tile holds one
 * version and three sit side by side, so per version a grid wins on height
 * and always will.** What the list buys is one destination instead of five,
 * a status word per row, a count per group, the archive inline, and columns
 * that line up. Those were the reasons; height was not one.
 * ⚠️ THE ARCHIVED VERSIONS PAGE AND ITS BUTTON ABOVE ARE DELIBERATELY
 * STILL HERE. They are now a second route to a subset of this list rather than
 * the only route to it. **Retiring them is a product decision and is the
 * user's**; nothing here depends on them going. */

/** The status word on each row. **A dot and lowercase text, not a filled pill**:
 *  at one line per row a pill on all 35 would out-shout the names it is
 *  annotating. Colour is this page's choice; the registry only hands over a
 *  key. */
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

export const dynamic = "force-dynamic";

/* 📌 `VersionTile` MOVED OUT ON 2026-09-28, to
 * `@/components/automations/version-tile`, when the Archived Versions page
 * needed to render the same thing. **A tile that drifted between the two
 * lists would make one version look like two different things depending on
 * where you found it.**
 * ⚠️ That is a LEAF moving to a shared folder, which the registry's own note
 * allows. It is not the same as sharing a bench page's LAYOUT, which is still
 * forbidden. */

export default async function AutomationsFeatureIntegrationPage() {
  await requireAuth();

  // Saved checklist state (shared app-wide). Seeds the tables so the checkboxes
  // render with their stored values on load.
  const state = await getFeatureIntegrationMap();

  // ⚠️ GROUPED BY `versionGroupLabel`, NOT BY `family`. Several versions have
  // no family at all (the Main Page betas and alphas, the toolbar gallery), so
  // a `family` grouping would drop them; see that function's own note for why
  // it is not simply a field.
  const groups: { name: string; items: typeof AUTOMATION_VERSIONS }[] = [];
  for (const version of AUTOMATION_VERSIONS) {
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

  return (
    /* ⭐⭐ THE PAGE KEEPS ITS WIDTH AND SCROLLS SIDEWAYS, 2026-09-23. The last
       page of the narrow-window pass and **the only one that was not broken** -
       nothing here clipped, collapsed or wrapped by accident, and the survey
       cleared it twice. The user asked for it anyway, for consistency with the
       other six. Recorded so nobody "fixes" this back out as unnecessary: it is
       a deliberate uniformity choice, not a bug fix.
       🛑 WHY THE SCROLLER IS HERE AND NOT ON `<main>`: `<main>` is
       `overflow-x-clip`, which cuts overflow off WITHOUT creating a scroll
       container, and changing it would re-anchor `position: sticky` on every
       dashboard page.
       📊📊 WHY THE FLOOR IS 1009px, RAISED FROM 722 ON 2026-09-30. The floor is
       set by the ONE capability table, which is now transposed (a row per
       website, eight capability columns) after the Alpha2 bench was promoted.
       **961px is that table's measured min-content, + the 48px of `p-6`.**
       ⚠️⚠️ THIS IS THE PRICE OF THE NEW LAYOUT AND IT WAS PAID DELIBERATELY. The
       old pair of tables compressed to a 510px min-content, so 722 cleared them
       easily; eight readable column headers do not compress that way. The
       page-level scrollbar now appears below a **1312px window** (measured:
       1311 overflows by 1px, 1312 by 0) instead of about 1025.
       📌 THE PRINCIPLE BEHIND THE NUMBER IS UNCHANGED, which is why it moved at
       all: **the floor is whatever lets the table render without an inner
       scrollbar of its own.** Leaving it at 722 would have worked, and would
       have put a second horizontal scrollbar inside the card.
       ⚠️ THE TILE GRIDS ARE FINE AT THE NEW WIDTH: they fold at `@min-[674px]`,
       which 961 clears, so they stay at three columns.
       ⚠️⚠️ THE FLOOR ALONE WOULD NOT HAVE BEEN ENOUGH HERE. The tile grids
       folded on `sm:`/`lg:`, which are VIEWPORT media queries: they ask the
       window, and the window has no idea this page now holds its own width. They
       had to become CONTAINER queries in the same change or the tiles would
       still have dropped to two columns at 1023 with the content box sitting at
       674. **Any page floored in this tab needs its responsive utilities
       audited for viewport breakpoints.** */
    <div className="overflow-x-auto">
      <div className="min-w-[1009px] space-y-6 p-6">
        <Link
          href="/automations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Automations
        </Link>

        {/* ⭐⭐ THE ARCHIVE LINK LIVES IN THE PAGE HEADER, 2026-09-28: "Create a
            new button somewhere here that leads to a new page."
            📌 WHY THE HEADER AND NOT ONE OF THE THREE CARDS: a version can be
            archived out of ANY of them (a bench, the light/dark card, the
            dropdown-config card), so hanging the link off one card would imply
            it only covers that card's pages. In the header it belongs to the
            page, which is what it actually describes.
            ⚠️ `items-start`, not `items-center`: the left block is two lines
            and the button is one, so centring would float it between the title
            and the subtitle instead of aligning it with the title. Same
            reasoning as the Edit mode toggle on the Dropdown Config page.
            📌 IT DOES NOT OPEN IN A NEW TAB, unlike every version tile. Those
            are experiments you compare side by side; this is another page of
            this directory, and it has a Back link. */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Automations Feature Integration
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              This page is a documentation of hidden features for the
              Automations tab.
            </p>
          </div>
          <Link
            href="/automations/archived-versions"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
            )}
          >
            <Archive className="mr-2 h-3.5 w-3.5" />
            Archived Versions
          </Link>
        </div>

        <FeatureIntegrationTables initialState={state} />

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-2">
              <h2 className="text-sm font-semibold text-zinc-900">
                Design Versions
              </h2>
              <span className="text-xs text-zinc-500">
                {AUTOMATION_VERSIONS.length} pages, each opens in a new tab
              </span>
            </div>

            {groups.map((group) => (
              <div key={group.name}>
                {/* A group heading costs one 24px strip. As four cards it cost
                    a card header, a subtitle and the gap above it, each. */}
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
                          `display`, and this is a flex child that already has
                          one; see the line-clamp note in memory. One line
                          either way, and truncate cannot be silently killed by
                          a utility emitted after it.
                          ⚠️ THIS IS ALSO WHY THE PAGE'S FLOOR IS NOT WIDER: a
                          nowrap child reports its whole text as min-content, so
                          this list "measures" 1017px and works at far less. */}
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
      </div>
    </div>
  );
}
