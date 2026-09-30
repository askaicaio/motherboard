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
import { AUTOMATION_VERSIONS } from "@/lib/automations/versions";

export default async function AutomationsDesignVersionsPage() {
  await requireAuth();

  const shipped = AUTOMATION_VERSIONS.filter((v) => v.shipped).length;

  return (
    /* 📐 THE SAME FLOOR AND SCROLLER AS THE FEATURE INTEGRATION PAGE (1009px).
       Matched rather than re-measured: this page renders the same list
       component inside the same card at the same padding, so its content
       cannot need more room than the page it is reached from. **Re-measure if
       a wider element ever lands here.**
       ⚠️ IT WAS 722px WHILE THIS PAGE SHOWED TILES. The list that replaced
       them is wider, and the host page's floor moved for the same reason.
       🛑 THE SCROLLER IS ON THIS DIV, NOT ON `<main>`: the dashboard layout
       gives `<main>` `overflow-x-clip`, which cuts overflow WITHOUT making a
       scroll container, so every page carries its own. */
    <div className="overflow-x-auto">
      <div className="min-w-[1009px] space-y-6 p-6">
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
            of them still work.
          </p>
        </div>

        <VersionDirectoryList />
      </div>
    </div>
  );
}
