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
    /* 📐📐 THE FLOOR IS 820px, LOWERED FROM 1009 ON 2026-09-30 AND MEASURED
       THIS TIME. It had been matched to the Feature Integration page rather
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
       ⚠️ IT WAS 722px WHILE THIS PAGE SHOWED TILES, then 1009 while it showed
       flex rows. Third value, third layout; that is the floor doing its job,
       not churn.
       ✅ MEASURED THRESHOLD: the page-level scrollbar appears below a 1123px
       window (1122 overflows by 1px, 1123 by 0), where it used to appear
       below 1312.
       🛑 THE SCROLLER IS ON THIS DIV, NOT ON `<main>`: the dashboard layout
       gives `<main>` `overflow-x-clip`, which cuts overflow WITHOUT making a
       scroll container, so every page carries its own. */
    <div className="overflow-x-auto">
      <div className="min-w-[820px] space-y-6 p-6">
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
            Every parallel design of a page in this tab, grouped by the
            experiment it belongs to. {shipped} of them are what a live page now
            renders; the rest are open, waiting on a decision, or settled. All
            of them still work. Click any status to change it.
          </p>
        </div>

        <VersionDirectoryList initialOverrides={overrides} />
      </div>
    </div>
  );
}
