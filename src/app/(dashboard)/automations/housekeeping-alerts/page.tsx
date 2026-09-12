// Automations "Housekeeping Alerts" page, reached from the FOURTH button in the
// Main Page toolbar strip.
//
// ⭐ THE ASK, from 2026-09-03: "the page that shows what still needs to be
// manually evaluated." It sat in the backlog as a name and an intent for ten
// days, deliberately unbuilt, because the contents were the user's to specify.
// They were specified on 2026-09-13 and the reasoning is in
// `@/lib/automations/housekeeping` — read that first, it is where the decisions
// live.
//
// ⚠️ THE ONE-LINE VERSION: this is an EVALUATION QUEUE, not a documentation
// report. Every "missing field" rule flags 473-526 of the 917 rows, so a
// documentation worklist would have been a permanent 500-item list. The
// Evaluation column is a real lifecycle with a real end state, so a queue built
// on it can actually reach zero.
//
// 📌 THE MEASUREMENT HALF OF THIS FEATURE ALREADY SHIPPED elsewhere and is not
// repeated here: "Documentation by Field" in the live hub's detail panel. That
// answers "how complete is our record"; this page answers "which rows are
// waiting on me".
//
// ⚠️ A LITERAL ROUTE SEGMENT, like `feature-integration`, so it takes precedence
// over the sibling `[platform]` dynamic route for this exact path. The name
// matches the toolbar button and the backlog item; do not shorten it.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAuth } from "@/lib/auth/guard";
import { HousekeepingAlertsClient } from "@/components/automations/housekeeping-alerts-client";
import {
  getEvaluationOptions,
  getHousekeepingQueue,
} from "@/lib/automations/housekeeping";

export const dynamic = "force-dynamic";

export default async function AutomationsHousekeepingAlertsPage() {
  await requireAuth();

  // ⚠️ TWO READS, IN PARALLEL. Small enough that the hub's wave rule does not
  // apply (that page runs ten), but they are independent so there is no reason
  // to pay two round trips. See [[db-pool-max-10-fanout]] before adding more.
  const [rows, options] = await Promise.all([
    getHousekeepingQueue(),
    getEvaluationOptions(),
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
        {/* ⚠️ THE SUBTITLE NAMES THE COLUMN ON PURPOSE. "Needs evaluation" is
            ambiguous until you know it means the Evaluation field specifically,
            and the difference matters: this page ignores every other kind of
            gap, which is a deliberate narrowing rather than an oversight. */}
        <p className="mt-1 text-sm text-zinc-500">
          Automations still waiting on an Evaluation. Setting one here files it
          straight away and takes the row off this list.
        </p>
      </div>

      <HousekeepingAlertsClient initialRows={rows} options={options} />
    </div>
  );
}
