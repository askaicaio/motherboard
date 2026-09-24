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
import { ArrowLeft, ExternalLink } from "lucide-react";
import { FeatureIntegrationTables } from "@/components/automations/feature-integration-tables";
import { getFeatureIntegrationMap } from "@/lib/automations/feature-integration";
import { Card, CardContent } from "@/components/ui/card";
import {
  AUTOMATION_BENCH_VERSIONS,
  AUTOMATION_LIGHT_DARK_VERSIONS,
  type AutomationVersion,
} from "@/lib/automations/versions";

export const dynamic = "force-dynamic";

/** One directory tile. **Hoisted on 2026-09-13 when a second list appeared**,
 *  so the parked pair and the active benches cannot drift into looking like two
 *  different kinds of link. They are the same kind of link; only the section
 *  they sit in differs.
 *
 *  ⚠️ `target="_blank"` IS THE REQUEST, not a flourish: "Clicking each page here
 *  results in a new tab being opened that leads to that page." `rel="noreferrer"`
 *  comes with it as the usual companion.
 *  ⚠️⚠️ `prefetch={false}` IS DELIBERATE AND SHOULD STAY. Every one of these
 *  routes is `force-dynamic` and runs the hub's full query set, so a default
 *  prefetch would fire a full page render PER TILE as soon as the section
 *  entered the viewport. One prefetch = one whole render, and it is only worth
 *  paying where a click is likely. **A directory you scan is not that.** */
function VersionTile({ version }: { version: AutomationVersion }) {
  return (
    <Link
      href={version.href}
      target="_blank"
      rel="noreferrer"
      prefetch={false}
      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50"
    >
      <version.icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-900">
            {version.label}
          </span>
          {/* The new-tab tell. Muted until hover so a grid of them does not
              read as a grid of warnings. */}
          <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500">
          {version.blurb}
        </span>
      </span>
    </Link>
  );
}

export default async function AutomationsFeatureIntegrationPage() {
  await requireAuth();

  // Saved checklist state (shared app-wide). Seeds the tables so the checkboxes
  // render with their stored values on load.
  const state = await getFeatureIntegrationMap();

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
       📊 WHY THE FLOOR IS 722px: it reproduces the appearance this page's OWN
       `lg` breakpoint already defined as its desktop layout, which is 674px of
       content (+ the 48px of `p-6`). At that width the tiles are three columns
       of 211px and **both feature tables still fit without their own inner
       scrollbar** - they compress down to a 510px min-content, so 674 clears
       them by 164. The scrollbar appears at about a 1025px window.
       ⚠️⚠️ THE FLOOR ALONE WOULD NOT HAVE BEEN ENOUGH HERE. The tile grids
       folded on `sm:`/`lg:`, which are VIEWPORT media queries: they ask the
       window, and the window has no idea this page now holds its own width. They
       had to become CONTAINER queries in the same change or the tiles would
       still have dropped to two columns at 1023 with the content box sitting at
       674. **Any page floored in this tab needs its responsive utilities
       audited for viewport breakpoints.** */
    <div className="overflow-x-auto">
      <div className="min-w-[722px] space-y-6 p-6">
        <Link
          href="/automations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Automations
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Automations Feature Integration
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Motherboard app features enabled by website API integrations.
          </p>
        </div>

        <FeatureIntegrationTables initialState={state} />

        {/* ⭐⭐ DESIGN VERSIONS, 2026-09-08: "add a new section below ... This
          section is where all the Beta and Alpha pages can be accessed."
          Aesthetics were left to me ("I'll let you decide"), so it borrows the
          two tables above: the same `Card`, the same `bg-zinc-50` header
          strip, the same `border-b px-3 py-2` rhythm. It reads as a third
          section of this page rather than a new kind of thing.
          🛑🛑 THIS IS NOW THE ONLY WAY TO REACH THE BENCHES. The sidebar's
          Automations dropdown was removed in the same change, so if this
          section goes, the Alphas and Betas are unreachable except by typing
          the URL. Nothing else links them.
          ⚠️ The new-tab and no-prefetch rules moved to `VersionTile` above,
          which both sections share.
          ⚠️ The blurbs come from `@/lib/automations/versions`, which took them
          from each page's OWN header comment. Do not rewrite them here; fix
          them there so the page and its description cannot drift.
          ⭐ THERE ARE TWO SECTIONS AS OF 2026-09-13. This one is the active
          benches; the parked pair has its own card below. */}
        <Card>
          {/* ⚠️⚠️ `@container` IS LOAD-BEARING, 2026-09-23. The grid below used
            to fold on `sm:`/`lg:` VIEWPORT breakpoints, and **a page floor
            cannot hold a viewport query** - it asks the window, which does not
            know this page now keeps its own width and scrolls. Without this the
            tiles would still drop to two columns at a 1023px window while the
            content box sat at its 674px floor. Making the card a container lets
            the grid answer to ITS OWN width. Same reasoning, same pattern as the
            hub's detail panel; see its note. */}
          <CardContent className="@container p-0">
            <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
              {/* ⚠️ "Experimental" was added on 2026-09-11 at the user request.
                It earns its place: this section links parallel designs of pages
                that already exist and work, and without that word the heading
                reads like a list of releases rather than a bench. The live hub
                is deliberately NOT in here. */}
              <h2 className="text-sm font-semibold text-zinc-900">
                Experimental Design Versions
              </h2>
              <span className="text-xs text-zinc-500">
                {AUTOMATION_BENCH_VERSIONS.length} pages, each opens in a new
                tab
              </span>
            </div>
            {/* ⚠️ CONTAINER QUERIES, NOT VIEWPORT ONES, since 2026-09-23. The
              two numbers are the OLD breakpoints expressed as this card's width,
              so the fold happens where it always did: `sm` (640px window) put
              304px of content here, `lg` (1024px) put 674px. **With the page's
              674px floor the card never goes below the second one, so this is
              three columns at every width and the page scrolls instead** - which
              is the whole point of flooring it. The rules stay for the day the
              floor changes or this card is reused somewhere narrower. */}
            <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
              {AUTOMATION_BENCH_VERSIONS.map((version) => (
                <VersionTile key={version.href} version={version} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ⭐⭐ THE LIGHT/DARK PAGES, IN THEIR OWN CARD, 2026-09-13: "Lets leave
          the AlphaA1 and AlphaA2 now. They will remain in alpha indefinitely
          unless corpo says its something they want. In the feature integration
          page, Put their own separate window from the rest of the test pages."
          🛑🛑 WHAT THE SPLIT IS ABOUT CHANGED ON 2026-09-24, so read this carefully.
          It used to be about WHOSE MOVE IT IS: everything in the card above was
          still being explored, and these were finished and waiting on a business
          decision. **Then the user asked for AlphaA3 to join them** - "Move the
          AlphaA3 access button into this section" - and AlphaA3 is NOT waiting on
          anyone. So the card is now about SUBJECT: these are the pages about
          light and dark mode. The list filters on `family`, and `parked` went
          back to meaning only what it says.
          ⚠️ DO NOT READ "in this card" AS "parked". Two of the three are; the
          third is an active bench. See `family` in `versions.ts`.
          📌 THEY ARE STILL ORDINARY TILES, deliberately: same component, same
          new-tab behaviour, same no-prefetch. Only the section differs, because
          the pages are not lesser.
          ⚠️ THEY ARE ONE FEATURE IN THREE TAKES and the subtitle says so, which
          is why they are grouped rather than listed as unrelated tiles. */}
        <Card>
          {/* ⚠️⚠️ `@container` IS LOAD-BEARING, 2026-09-23. The grid below used
            to fold on `sm:`/`lg:` VIEWPORT breakpoints, and **a page floor
            cannot hold a viewport query** - it asks the window, which does not
            know this page now keeps its own width and scrolls. Without this the
            tiles would still drop to two columns at a 1023px window while the
            content box sat at its 674px floor. Making the card a container lets
            the grid answer to ITS OWN width. Same reasoning, same pattern as the
            hub's detail panel; see its note. */}
          <CardContent className="@container p-0">
            <div className="flex items-start justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
              <div className="min-w-0">
                {/* 📌 "Pair" UNTIL 2026-09-24, when AlphaA3 made it three. The
                  subtitle also stopped claiming the whole card is parked,
                  because AlphaA3 is not. */}
                <h2 className="text-sm font-semibold text-zinc-900">
                  Light / Dark Mode
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  One design in two themes. AlphaA1 and AlphaA2 are two routes
                  linked by a toggle; AlphaA3 does it on a single route.
                </p>
              </div>
              <span className="shrink-0 text-xs text-zinc-500">
                {AUTOMATION_LIGHT_DARK_VERSIONS.length} pages, each opens in a
                new tab
              </span>
            </div>
            {/* ⚠️ CONTAINER QUERIES, NOT VIEWPORT ONES, since 2026-09-23. The
              two numbers are the OLD breakpoints expressed as this card's width,
              so the fold happens where it always did: `sm` (640px window) put
              304px of content here, `lg` (1024px) put 674px. **With the page's
              674px floor the card never goes below the second one, so this is
              three columns at every width and the page scrolls instead** - which
              is the whole point of flooring it. The rules stay for the day the
              floor changes or this card is reused somewhere narrower. */}
            <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
              {AUTOMATION_LIGHT_DARK_VERSIONS.map((version) => (
                <VersionTile key={version.href} version={version} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
