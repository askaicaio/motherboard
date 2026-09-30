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
import { Archive, ArrowLeft } from "lucide-react";
import { FeatureIntegrationTables } from "@/components/automations/feature-integration-tables";
import { getFeatureIntegrationMap } from "@/lib/automations/feature-integration";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { VersionTile } from "@/components/automations/version-tile";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_BENCH_VERSIONS,
  AUTOMATION_DROPDOWN_CONFIG_VERSIONS,
  AUTOMATION_FEATURE_INTEGRATION_VERSIONS,
  AUTOMATION_LIGHT_DARK_VERSIONS,
  AUTOMATION_VERSION_DIRECTORY_VERSIONS,
} from "@/lib/automations/versions";

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
          benches; the parked pair has its own card below.
          🛑🛑 AND AS OF 2026-09-28 THIS CARD IS USUALLY NOT RENDERED AT ALL. The
          user archived all eleven of its pages in one go, so the list is empty
          and the guard below hides it. **The note above about this being the
          only way to reach the benches is now the ARCHIVE page's job**; the
          button in this page's header is what gets you there.
          ⭐ IT RETURNS BY ITSELF the moment a new bench is registered. */}
        {AUTOMATION_BENCH_VERSIONS.length > 0 && (
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
        )}

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

        {/* ⭐⭐ THE DROPDOWN CONFIG LAYOUT BENCHES, 2026-09-25. Six designs for
          ONE page, after the user asked: "Can you suggest other better ways to
          layout the UI on this page? How many Alpha pages can you create so i can
          see the samples?"
          📌 WHY THEY ARE NOT IN THE CARD ABOVE THIS ONE: everything there is a
          design for the MAIN page, and six tiles for a different page would have
          swamped it. Grouping is the whole reason `family` exists.
          🛑 AND WHY THIS CARD MUST NOT IMPLY "PARKED": these were asked for today
          and the next move is ours. The light/dark card happens to hold two
          parked pages; that is a fact about those pages, not about having a card.
          See `family` in `versions.ts`.
          🛑 AS OF 2026-09-28 ALL SIX WERE ARCHIVED TOGETHER, so this card is
          hidden too. Same guard, same reason as the benches card above: an
          empty card is a heading and a count describing nothing, and with two
          of the three empty at once the page reads as broken rather than tidy.
          The six are on the Archived Versions page. */}
        {AUTOMATION_DROPDOWN_CONFIG_VERSIONS.length > 0 && (
          <Card>
            <CardContent className="@container p-0">
              <div className="flex items-start justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Dropdown Configuration Layouts
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Six ways to lay out the same page. The data and the editing
                    behaviour are the live page&rsquo;s; only the layout
                    differs.
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {AUTOMATION_DROPDOWN_CONFIG_VERSIONS.length} pages, each opens
                  in a new tab
                </span>
              </div>
              <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
                {AUTOMATION_DROPDOWN_CONFIG_VERSIONS.map((version) => (
                  <VersionTile key={version.href} version={version} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ⭐⭐ EIGHT LAYOUTS FOR *THIS* PAGE, 2026-09-29: "Got any suggestions
          on UI layout for this page? pls make as many Alphas as you can
          suggest."
          🛑🛑 SO THIS PAGE NOW LISTS BENCHES OF ITSELF, and that is not a
          mistake to tidy up. The directory of versions has always lived here;
          a set that happens to redesign the host page is still reached the
          same way. **Each bench carries a strip back to its seven siblings**,
          so you can compare without returning here every time.
          📌 WHY ITS OWN CARD RATHER THAN THE BENCH LIST ABOVE: same reason as
          the dropdown six. Everything in that card redesigns the MAIN page,
          and eight tiles for a different page would swamp it. Grouping is what
          `family` is for.
          🛑 NONE OF THEM IS PARKED, and the card must not imply it. They were
          asked for today and the next move is ours.
          ⚠️ ALPHA4 CARRIES UNREVIEWED COPY (a paragraph per capability and a
          reason under every gap) and says so on the page itself. It is the
          only one that adds sentences rather than rearranging the marks. */}
        {AUTOMATION_FEATURE_INTEGRATION_VERSIONS.length > 0 && (
          <Card>
            <CardContent className="@container p-0">
              <div className="flex items-start justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Feature Integration Layouts
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Eight ways to lay out this page. All of them read the same
                    saved marks; only the layout differs.
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {AUTOMATION_FEATURE_INTEGRATION_VERSIONS.length} pages, each
                  opens in a new tab
                </span>
              </div>
              <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
                {AUTOMATION_FEATURE_INTEGRATION_VERSIONS.map((version) => (
                  <VersionTile key={version.href} version={version} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ⭐⭐ SIX LAYOUTS FOR THIS SECTION ITSELF, 2026-09-30. The user
          circled the card above: "Any suggestions on how to show these layouts
          differently? pls make Alpha pages for them."
          🛑🛑 AND THIS CARD IS THE FIFTH ONE, WHICH IS THE POINT THEY ARE
          ANSWERING. The directory grows by CARD: one per family, plus the
          Archived page. **Adding a family adds a card, and a card that lists
          designs for the card list is where that stops being funny.** Every one
          of the six proposes a shape that does not grow this way.
          📌 THEY ARE "Version Directory AlphaN", NOT another Feature
          Integration set: the prefix names WHAT IS BEING REDESIGNED, and the
          eight above redesign this page's capability table, not this list.
          ⚠️ EACH ONE LISTS EVERY VERSION, so none of them carries an "other
          layouts" strip. They reach each other by being what they are. */}
        {AUTOMATION_VERSION_DIRECTORY_VERSIONS.length > 0 && (
          <Card>
            <CardContent className="@container p-0">
              <div className="flex items-start justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Version Directory Layouts
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Six ways to show the lists on this page, including the one
                    you are reading. Each lists every version, archived
                    included.
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {AUTOMATION_VERSION_DIRECTORY_VERSIONS.length} pages, each
                  opens in a new tab
                </span>
              </div>
              <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
                {AUTOMATION_VERSION_DIRECTORY_VERSIONS.map((version) => (
                  <VersionTile key={version.href} version={version} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
