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
import { AUTOMATION_BENCH_VERSIONS } from "@/lib/automations/versions";

export const dynamic = "force-dynamic";

export default async function AutomationsFeatureIntegrationPage() {
  await requireAuth();

  // Saved checklist state (shared app-wide). Seeds the tables so the checkboxes
  // render with their stored values on load.
  const state = await getFeatureIntegrationMap();

  return (
    <div className="space-y-6 p-6">
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
          ⚠️ `target="_blank"` IS THE REQUEST, not a flourish: "Clicking each
          page here results in a new tab being opened that leads to that page."
          `rel="noreferrer"` comes with it as the usual companion.
          ⚠️⚠️ `prefetch={false}` IS DELIBERATE AND SHOULD STAY. These nine
          routes are all `force-dynamic` and each runs the hub's full query set,
          so a default prefetch would fire NINE full page renders as soon as
          this section entered the viewport. That lesson is written up in
          [the beta rail's prefetch note]: one prefetch = one whole render, and
          it is only worth paying where a click is likely. Here it is not: this
          is a directory you scan, not a control you keep clicking.
          ⚠️ The blurbs come from `@/lib/automations/versions`, which took them
          from each page's OWN header comment. Do not rewrite them here; fix
          them there so the page and its description cannot drift. */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
            {/* ⚠️ "Experimental" was added on 2026-09-11 at the user request.
                It earns its place: this section links ELEVEN parallel designs of
                pages that already exist and work, and without that word the
                heading reads like a list of releases rather than a bench. The
                live hub is deliberately NOT in here. */}
            <h2 className="text-sm font-semibold text-zinc-900">
              Experimental Design Versions
            </h2>
            <span className="text-xs text-zinc-500">
              {AUTOMATION_BENCH_VERSIONS.length} pages, each opens in a new tab
            </span>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {AUTOMATION_BENCH_VERSIONS.map((version) => (
              <Link
                key={version.href}
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
                    {/* The new-tab tell. Muted until hover so nine of them do
                        not read as nine warnings. */}
                    <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {version.blurb}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
