// =============================================================
// Automations "Design Versions", route /automations/design-versions
// =============================================================
// ⭐ EVERY PARALLEL DESIGN OF EVERY PAGE IN THIS TAB, on one page.
//
// 🏷️🏷️ IT WAS "Archived Versions" AT `/automations/archived-versions` UNTIL
// 2026-09-30. The user circled the button that opens it: "Rename this into
// 'Design Versions'", and chose, when asked how far the rename should go, for
// the page to show **all** versions rather than only the archived ones.
// ⚠️ **THE ROUTE MOVED WITH THE NAME, AND THE OLD ONE NOW 404s.** Normally a
// route is the expensive string here (the 2026-09-10 renumbering broke every
// old link), but this one was two days old and linked from exactly one button.
// 🛑 Leaving it at `archived-versions` while the page listed all 35 and called
// itself Design Versions would have made the URL lie, and **the user has
// already objected once to labels and URLs disagreeing** ("Rename their links
// as well, they don't match their actual name at the moment", 2026-09-10).
//
// ⚠️⚠️ THE FEATURE INTEGRATION PAGE RENDERS THE SAME LIST INLINE. That is a
// real duplicate and it is deliberate for now: the inline list was asked for
// hours earlier, on the same day, and removing it was not part of this
// request. **Both read the same component, so they cannot drift.** If one
// should go, that is a product call.
//
// 📌 WHAT "archived" MEANS NOW THAT IT NO LONGER PICKS A PAGE: it is one of
// the five states in the `status` column, nothing more. A version being
// archived used to MOVE it here; now it just changes a word on its row. See
// `archived` and `versionStatusKey` in `versions.ts`.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Layers } from "lucide-react";
import { VersionDirectoryList } from "@/components/automations/version-directory-list";
import { getVersionStatusOverrides } from "@/lib/automations/version-status";
import { AUTOMATION_VERSIONS } from "@/lib/automations/versions";

export const dynamic = "force-dynamic";

export default async function AutomationsDesignVersionsPage() {
  await requireAuth();

  const shipped = AUTOMATION_VERSIONS.filter((v) => v.shipped).length;

  // ⚠️ READ ON THE SERVER AND PASSED DOWN, not fetched by the list. **A
  // directory that flashed every row as "bench" and then corrected itself
  // would be worse than one that could not be edited at all.**
  const overrides = await getVersionStatusOverrides();

  return (
    /* 📐📐📐 THE FLOOR IS 1000px, RAISED FROM 820 WHEN THE RAIL LANDED ON
       2026-09-30. **A 240px rail plus its 16px gap is 256px the table no
       longer has**, and the description column is what pays for it. On the
       WIDEST tab (Feature Integration, whose names make the name column
       239px rather than Main Page's 185px) the description measures: 1000 ->
       183px, 1054 -> 237px, 1100 -> 283px.
       ⚠️⚠️ 1054 WOULD HAVE MATCHED THE ~230px THE LAST FLOOR WAS CHOSEN FOR,
       AND IT WAS NOT TAKEN. It puts the sideways scrollbar below a 1357px
       window, past a 1366px laptop by 9px. **1000 keeps the threshold at
       1303 and costs the widest tab about seven characters**, which is the
       better side of that trade. Revisit if the descriptions turn out to be
       what people read here.
       📌 MEASURE THE WIDEST TAB, NOT THE DEFAULT ONE. Main Page opens by
       default and its names are 54px shorter, so measuring it would have
       flattered the floor by exactly that much.

       📐 THE PREVIOUS FLOOR, KEPT FOR THE REASONING: 820px, lowered from 1009
       on 2026-09-30 and measured then too. It had been matched to the Feature Integration page rather
       than measured, which stopped being right when the list became a table:
       **the blurb cell is `w-full max-w-0`, so it no longer reports its whole
       text as min-content and the page's real minimum fell to 591px.**
       📊 WHY 820 AND NOT 591. Min-content is where nothing BREAKS, not where
       the page is usable, and at 591 the description column is 110px of
       ellipsis. Measured the description at a range of widths: 700 -> 110px,
       760 -> 170px, **820 -> 230px**, 900 -> 310px, 1009 -> 419px. 230px is
       about 35 characters, which still reads as a sentence fragment rather
       than a stub. **The floor is a judgement about acceptable abbreviation;
       the measurement only tells you what you are buying.**
       ⭐ THE NAME COLUMN IS 239px AT EVERY ONE OF THOSE WIDTHS. A table column
       sizes to its widest cell and does not get squeezed, which is the whole
       reason the names stopped truncating.
       ⚠️ IT WAS 722px WHILE THIS PAGE SHOWED TILES, 1009 while it showed flex
       rows, 820 as a table and 1000 as a table with a rail. **Four values,
       four layouts; that is the floor doing its job, not churn.**
       ✅ MEASURED THRESHOLD: the page-level scrollbar appears below a 1288px
       window (1287 overflows by 1px, 1288 by 0). It was 1123 without the
       rail and 1312 before the table, so **a 1366px laptop still clears it**.
       🛑 THE SCROLLER IS ON THIS DIV, NOT ON `<main>`: the dashboard layout
       gives `<main>` `overflow-x-clip`, which cuts overflow WITHOUT making a
       scroll container, so every page carries its own. */
    <div className="overflow-x-auto">
      <div className="min-w-[1000px] space-y-6 p-6">
        <Link
          href="/automations/feature-integration"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feature Integration
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Design Versions
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Every parallel design of a page in this tab. Pick an experiment on
            the left; {shipped} of the {AUTOMATION_VERSIONS.length} are what a
            live page now renders, and the rest are open, waiting on a decision,
            or settled. All of them still work. Click any status to change it.
          </p>
        </div>

        <VersionDirectoryList initialOverrides={overrides} />
      </div>
    </div>
  );
}
