// ---------------------------------------------------------------------------
// HOUSEKEEPING ALERTS: the Evaluation queue.
//
// ⭐ WHAT THE PAGE IS, in the user's original words (2026-09-03): "the page that
// shows what still needs to be manually evaluated." It sat in the backlog as a
// name and an intent for ten days, deliberately unbuilt, until the contents were
// specified on 2026-09-13.
//
// ⭐⭐ AND THE THING IT TURNED OUT TO BE IS NARROWER THAN THE NAME SUGGESTS. The
// obvious reading was "every row missing any documentation", and the live
// numbers killed that: every documentation rule flags 473-526 of the 917 rows.
// **A worklist with 500 permanent items on it is a report, not a queue.** The
// user's word "evaluated" pointed at the app's OWN `Evaluation` column instead,
// which is a real lifecycle with a real end state.
//
// 📌 THE MEASUREMENT HALF OF THIS FEATURE ALREADY SHIPPED and is not duplicated
// here: "Documentation by Field" in the live hub's detail panel ranks how
// completely each field is filled, per website. **That answers "how complete is
// our record". This page answers "which specific rows are waiting on me".**
//
// ---------------------------------------------------------------------------
// WHAT COUNTS AS "IN THE QUEUE"
// ---------------------------------------------------------------------------
// 🛑 SETTLED IS A CLOSED LIST OF TWO: **"To Remove" and "Keep"**. Everything
// else is in the queue, INCLUDING a state someone adds later on the Dropdown
// Configuration page. That direction is deliberate: a new custom state appears
// in the queue rather than silently vanishing from it, which is the failure that
// would be invisible.
//
// ⚠️ "To Remove" IS SETTLED EVEN THOUGH THE WORK IS NOT DONE, and this was the
// user's explicit call (2026-09-13). Those 39 rows have had their decision made;
// somebody still has to go and delete them on the source platform, but that is
// an ACTION list and this page is a DECISION list. Do not quietly fold them back
// in. If an action list is ever wanted, it is a second section or a second page.
//
// 📊 THE SHAPE OF THE QUEUE AT BUILD TIME (917 rows total, read 2026-09-13):
//     Unknown            12   someone looked and could not decide
//     To Remove?        152   provisional
//     Keep?             120   provisional
//     never evaluated   526   nobody has looked
//     ---------------------
//     in the queue      810   (settled: To Remove 39, Keep 68)
//
// **The never-evaluated tail is CONCENTRATED, not spread**: n8n (157) and
// GHL B2B (105) have never been evaluated at all, GHL is mostly untouched (262
// of 344), and Make and Zapier are effectively done. That is why the page has a
// per-website filter: it is the difference between one impossible list and three
// tractable ones.
// ---------------------------------------------------------------------------

import { asc, eq, inArray, isNull, not, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { automationDropdownChoices, automations } from "@/lib/db/schema";

/** The two states that take a row OUT of the queue. See the header: this list
 *  is closed on purpose, so anything else (including a custom state) stays in. */
export const SETTLED_EVALUATIONS = ["To Remove", "Keep"] as const;

/** The queue's own grouping, most-blocked first. **Not the same as
 *  `TRIAGE_ORDER`**, which is the column's lifecycle order for sorting a table;
 *  this is about who is waiting on what:
 *    stuck       someone looked and could not decide. The only group that is
 *                explicitly blocked on a person.
 *    provisional a tentative answer with a question mark, waiting to be
 *                confirmed. The bulk of the real work.
 *    untouched   nobody has looked yet. The long tail. */
export type QueueGroup = "stuck" | "provisional" | "untouched";

export interface HousekeepingRow {
  id: string;
  name: string;
  platform: string;
  externalUrl: string;
  status: string;
  /** The current Evaluation value, or null when nobody has set one. */
  evaluation: string | null;
  evaluationChoiceId: string | null;
  badgeColor: string | null;
  textColor: string | null;
  group: QueueGroup;
}

/** Every automation still awaiting an Evaluation decision, newest-blocked first.
 *
 *  ⚠️ ONE QUERY, NOT ONE PER GROUP. The grouping is decided in JS from the value
 *  that comes back, so adding a group later costs nothing at the database. This
 *  page is reached from the hub's toolbar, so it does not share the hub's read
 *  budget, but two round trips would still be two round trips.
 *  📌 SORTED BY PLATFORM THEN NAME so the list is stable between loads and the
 *  website filter carves out contiguous blocks. The GROUP ordering is applied in
 *  the component, not here, because the component renders them as sections. */
export async function getHousekeepingQueue(): Promise<HousekeepingRow[]> {
  const rows = await db
    .select({
      id: automations.id,
      name: automations.name,
      platform: automations.platform,
      externalUrl: automations.externalUrl,
      status: automations.status,
      evaluation: automationDropdownChoices.value,
      evaluationChoiceId: automations.triageChoiceId,
      badgeColor: automationDropdownChoices.badgeColor,
      textColor: automationDropdownChoices.textColor,
    })
    .from(automations)
    .leftJoin(
      automationDropdownChoices,
      eq(automationDropdownChoices.id, automations.triageChoiceId),
    )
    .where(
      or(
        isNull(automations.triageChoiceId),
        not(inArray(automationDropdownChoices.value, [...SETTLED_EVALUATIONS])),
      ),
    )
    .orderBy(asc(automations.platform), asc(automations.name));

  return rows.map((r) => ({
    ...r,
    group: groupFor(r.evaluation),
  }));
}

/** Which section a row belongs to. Anything with a value that is not "Unknown"
 *  and not settled is PROVISIONAL, which is what makes a custom state land
 *  somewhere sensible instead of nowhere. */
function groupFor(evaluation: string | null): QueueGroup {
  if (!evaluation) return "untouched";
  if (evaluation === "Unknown") return "stuck";
  return "provisional";
}

/** The Evaluation options for the picker.
 *
 *  ⚠️ THE SETTLED ONES ARE INCLUDED AND MUST BE. They are how a row LEAVES the
 *  queue: picking "Keep" or "To Remove" here is the whole point of the page.
 *  Only the QUEUE excludes them, never the picker.
 *  📌 IT IS THE SAME QUERY THE PER-WEBSITE PAGE RUNS for its Edit dialog, down
 *  to the `asc(value)` ordering, so the two pickers cannot offer different
 *  options. The queue re-sorts into lifecycle order at render. */
export async function getEvaluationOptions() {
  return db
    .select({
      id: automationDropdownChoices.id,
      value: automationDropdownChoices.value,
      badgeColor: automationDropdownChoices.badgeColor,
      textColor: automationDropdownChoices.textColor,
    })
    .from(automationDropdownChoices)
    .where(eq(automationDropdownChoices.columnKey, "triage"))
    .orderBy(asc(automationDropdownChoices.value));
}
