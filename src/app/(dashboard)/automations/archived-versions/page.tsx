// =============================================================
// Automations "Archived Versions", route /automations/archived-versions
// =============================================================
// ⭐ WHERE RETIRED DESIGN VERSIONS GO. Created 2026-09-28: "Create a new button
// somewhere here that leads to a new page. The new page is meant to house
// Archived alphas that already have served their purpose."
//
// 📌 IT IS CALLED "VERSIONS", NOT "ALPHAS", DELIBERATELY. The user said alphas,
// and alphas are what will mostly land here, but the registry also holds three
// Betas and a Toolbar Options gallery that will eventually be just as finished.
// **Naming it for the narrower thing would have meant renaming the route later**,
// and a route is the one string that is expensive to change (see the 2026-09-10
// renumbering, which broke every old link).
//
// ⚠️⚠️ IT IS EMPTY UNTIL THE USER SAYS OTHERWISE, and that is not an oversight.
// Offered a recommended set to archive (the seven Main Page Alphas, five of the
// six Dropdown Config benches, Toolbar Options 1) and the user chose "Nothing
// yet, just build it". **Choosing what has served its purpose is their call**,
// the same rule the Impossible List runs on. Do not populate this from your own
// judgement; see `archived` in `versions.ts`.
//
// 🛑 ARCHIVED IS NOT PARKED AND NOT DELETED. Parked (the AlphaA light/dark trio)
// means the next move belongs to the business and the page is WAITING. Archived
// means there is nothing left to wait for. Deleted means gone, and nothing here
// is deleted: every archived page still works and still opens.
//
// ⚠️ THIS PAGE IS REACHED FROM ONE PLACE, the button in the Feature Integration
// header. Nothing else links it, exactly like the benches themselves. If that
// button goes, this page is URL-only.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { Archive, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { VersionTile } from "@/components/automations/version-tile";
import { AUTOMATION_ARCHIVED_VERSIONS } from "@/lib/automations/versions";

export default async function AutomationsArchivedVersionsPage() {
  await requireAuth();

  const archived = AUTOMATION_ARCHIVED_VERSIONS;

  return (
    /* 📐 THE SAME FLOOR AND SCROLLER AS THE FEATURE INTEGRATION PAGE (722px).
       Matched rather than re-measured: this page renders the same tile grid
       inside the same card at the same padding, so its content cannot need more
       room than the page it is reached from. **Re-measure if a wider element
       ever lands here.**
       🛑 THE SCROLLER IS ON THIS DIV, NOT ON `<main>`: the dashboard layout gives
       `<main>` `overflow-x-clip`, which cuts overflow WITHOUT making a scroll
       container, so every page carries its own. */
    <div className="overflow-x-auto">
      <div className="min-w-[722px] space-y-6 p-6">
        <Link
          href="/automations/feature-integration"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feature Integration
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Archived Versions
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Design versions that have served their purpose. They still work and
            still open; they are out of the way, not gone.
          </p>
        </div>

        <Card>
          <CardContent className="@container p-0">
            <div className="flex items-start justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Retired design versions
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  A version lands here once the question it was asking has been
                  settled.
                </p>
              </div>
              {/* ⚠️ THE "each opens in a new tab" TAIL IS DROPPED WHEN THE LIST
                  IS EMPTY. The other three cards on the Feature Integration page
                  say it unconditionally because they are never empty; this one
                  ships empty, and "0 pages, each opens in a new tab" promises
                  behaviour for pages that are not there. */}
              <span className="shrink-0 text-xs text-zinc-500">
                {archived.length} {archived.length === 1 ? "page" : "pages"}
                {archived.length > 0 ? ", each opens in a new tab" : ""}
              </span>
            </div>

            {archived.length === 0 ? (
              /* ⚠️ THE EMPTY STATE HAS TO EXPLAIN ITSELF, because this page will
                 be empty on the day it ships and an unexplained empty card reads
                 as broken. It says what the page is FOR and what fills it. */
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <Archive className="h-6 w-6 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-900">
                  Nothing is archived yet.
                </p>
                <p className="max-w-md text-xs text-zinc-500">
                  Every design version is still an open question, so they all
                  live on the Feature Integration page. When one has served its
                  purpose, it moves here and leaves that page.
                </p>
              </div>
            ) : (
              /* ⚠️ CONTAINER QUERIES, NOT VIEWPORT ONES. A page with its own
                 width floor cannot use `sm:`/`lg:`: those ask the WINDOW, which
                 does not know this page keeps its own width and scrolls. The two
                 numbers are the Feature Integration page's, so the two grids fold
                 at the same points. */
              <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
                {archived.map((version) => (
                  <VersionTile key={version.href} version={version} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
