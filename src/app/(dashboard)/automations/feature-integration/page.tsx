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
import { ArrowLeft, Layers } from "lucide-react";
import { FeatureIntegrationTables } from "@/components/automations/feature-integration-tables";
import { getFeatureIntegrationMap } from "@/lib/automations/feature-integration";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* 🛑🛑 THIS PAGE NO LONGER LISTS THE DESIGN VERSIONS AT ALL, as of
 * 2026-09-30. The user, on the inline list: "seems like we wont be needing
 * this anymore".
 * 📌 IT WAS A THREE-STEP DAY AND THE END STATE IS THE POINT. The directory
 * was four cards here, then one dense list here, then the same list in two
 * places once the Design Versions page grew a full list, and **a duplicate is
 * not a resting state.** It resolved onto its own page.
 * ⚠️⚠️ SO THE BUTTON IN THE HEADER IS NOW THE ONLY ROUTE TO EVERY BENCH.
 * Nothing else in the app links them: not the sidebar (its dropdown went on
 * 2026-09-08), not the hub. **If that button goes, 34 pages become
 * URL-only.** The registry says the same thing at the top of
 * `versions.ts`; it is worth saying twice.
 * ⭐ AND THE PAGE IS BACK TO ONE SUBJECT. It documents which capabilities each
 * website's API unlocks, which is what its title and subtitle claim. A
 * directory of unrelated design experiments was always a lodger here. */

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
       ⚠️ THERE ARE NO TILE GRIDS ON THIS PAGE ANY MORE, as of 2026-09-30: the
       four of them became one dense list. The container-query note below is
       kept because it is the general rule for this tab, not because anything
       here still folds.
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

        {/* ⭐⭐ THE DIRECTORY LINK LIVES IN THE PAGE HEADER. Added 2026-09-28
            as "Archived Versions"; **renamed and repointed on 2026-09-30** when
            the user circled it: "Rename this into 'Design Versions'". Asked how
            far that should go, they chose the destination page to show ALL
            versions rather than only the archived ones, so the route moved to
            `/automations/design-versions` with the name.
            📌 WHY THE HEADER AND NOT THE CARD BELOW: the link belongs to the
            page, not to one list on it. It also long predates that card.
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
            href="/automations/design-versions"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
            )}
          >
            <Layers className="mr-2 h-3.5 w-3.5" />
            Design Versions
          </Link>
        </div>

        <FeatureIntegrationTables initialState={state} />
      </div>
    </div>
  );
}
