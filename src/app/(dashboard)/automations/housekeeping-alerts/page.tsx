// Automations "Housekeeping Alerts" page, reached from the FOURTH button in the
// Main Page toolbar strip.
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
  getHousekeepingRows,
} from "@/lib/automations/housekeeping";
import { REQUIRED_COLUMNS } from "@/lib/automations/housekeeping-rule";

export const dynamic = "force-dynamic";

export default async function AutomationsHousekeepingAlertsPage() {
  await requireAuth();

  // ⚠️ SEE THE READ-BUDGET NOTE in `housekeeping.ts` before adding anything
  // here. These two together peak at five concurrent reads against a `max: 10`
  // pool, and the margin is deliberate.
  const [rows, choices] = await Promise.all([
    getHousekeepingRows(),
    getHousekeepingChoices(),
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Housekeeping Alerts
        </h1>
        {/* ⚠️ THE SUBTITLE NAMES THE FIVE COLUMNS rather than saying "incomplete
            records". The page's whole contract is those five and nothing else,
            and a reader who does not know that cannot tell why a row they think
            is finished is still listed. */}
        <p className="mt-1 text-sm text-zinc-500">
          Automations missing at least one of the {REQUIRED_COLUMNS.length}{" "}
          required columns: {REQUIRED_COLUMNS.join(", ")}. Click a row to fill
          it in.
        </p>
      </div>

      <HousekeepingAlertsClient initialRows={rows} choices={choices} />
    </div>
  );
}
