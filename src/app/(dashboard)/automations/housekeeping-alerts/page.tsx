// Automations "Housekeeping" page, reached from the FOURTH button in the Main
// Page toolbar strip.
//
// ⚠️⚠️ THE ROUTE IS STILL `/automations/housekeeping-alerts` AND THAT IS
// DELIBERATE. Only the LABEL changed (2026-09-18): "Alerts" was the weak half -
// nothing on this page alerts, it lists records nobody has finished typing, and
// the tab already uses "alerts" for Error History and Latest Errors, which are
// about automations that genuinely broke. **Reusing the word for "someone has
// not written a Purpose yet" made the real one quieter.**
// 📌 The folder, the component name and every `getHousekeeping*` identifier keep
// the old spelling so no link, bookmark or import breaks. **Do not rename the
// route to match the label** without a redirect.
//
// ⭐ THE ASK, 2026-09-03: "the page that shows what still needs to be manually
// evaluated." The RULE, given 2026-09-13: "these are the five columns that users
// are required to fill in. Automations show up in the housekeeping page when any
// of the following are true: Trigger Event, Automation Tags, and Evaluation
// containing 'None'. Purpose and Notes being blank."
//
// 📌 THE RULE LIVES IN `@/lib/automations/housekeeping-rule` and the reads in
// `@/lib/automations/housekeeping`. Both carry the reasoning; this file is just
// the shell.
//
// 🛑 THE FIRST VERSION OF THIS PAGE HAD THE WRONG RULE (an Evaluation-only
// queue, #532) and was rebuilt the same day. The why is written up in
// `housekeeping.ts`; the short version is that I inferred the contents from what
// the data could support instead of asking which columns were required.
//
// ⚠️ A LITERAL ROUTE SEGMENT, like `feature-integration`, so it takes precedence
// over the sibling `[platform]` dynamic route for this exact path.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAuth } from "@/lib/auth/guard";
import { HousekeepingAlertsClient } from "@/components/automations/housekeeping-alerts-client";
import {
  getHousekeepingChoices,
  getHousekeepingCoverage,
  getHousekeepingRows,
} from "@/lib/automations/housekeeping";
import { REQUIRED_COLUMNS } from "@/lib/automations/housekeeping-rule";

export const dynamic = "force-dynamic";

export default async function AutomationsHousekeepingAlertsPage() {
  await requireAuth();

  // ⚠️ SEE THE READ-BUDGET NOTE in `housekeeping.ts` before adding anything
  // here. These three together peak at FIVE concurrent reads against a `max: 10`
  // pool, and the margin is deliberate.
  // 📌 `getHousekeepingCoverage` is ONE query precisely so it can join this wave
  // without pushing the peak higher; it folds its junction count into an
  // `exists` rather than taking a second read. Its own note explains why.
  const [rows, choices, coverage] = await Promise.all([
    getHousekeepingRows(),
    getHousekeepingChoices(),
    getHousekeepingCoverage(),
  ]);

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
        <h1 className="text-2xl font-semibold tracking-tight">Housekeeping</h1>
        {/* ⚠️ IT USED TO NAME THE FIVE COLUMNS HERE and the user cut that list
            on 2026-09-18, replacing "Click a row to fill it in" with what
            actually clears a row.
            📌 The old argument was that a reader who does not know the contract
            cannot tell why a row they think is finished is still listed. It
            lost because **the names are already on screen twice** - the table
            headers spell them out left to right and the coverage panel lists
            all five - so the sentence was repeating the screen instead of
            telling the reader what to DO.
            ⚠️ THE COUNT IS STILL COMPUTED, not typed, so it cannot drift from
            the rule if a sixth column is ever required. */}
        <p className="mt-1 text-sm text-zinc-500">
          Automations missing at least one of the {REQUIRED_COLUMNS.length}{" "}
          required columns. Fill out the required information to clear the entry
          off the list.
        </p>
      </div>

      <HousekeepingAlertsClient
        initialRows={rows}
        choices={choices}
        coverage={coverage}
      />
    </div>
  );
}
