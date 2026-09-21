// ---------------------------------------------------------------------------
// THE HOUSEKEEPING RULE, and nothing else.
//
// ⚠️⚠️ THIS FILE HAS NO DATABASE IMPORT ON PURPOSE. The same rule has to run in
// two places: on the SERVER to build the page's list, and on the CLIENT to
// decide whether a row still belongs there after the Edit dialog saves it. A
// module that touches `@/lib/db` cannot be imported by a client component, so
// the rule lives here alone and `housekeeping.ts` does the querying.
// **If the rule ever disagrees between server and client, the row will either
// refuse to leave the list or vanish while still unfilled.** Keep it here.
//
// ⭐⭐ THE RULE, in the user's own words (2026-09-13): "these are the five
// columns that users are required to fill in. Automations show up in the
// housekeeping page when any of the following are true: Trigger Event,
// Automation Tags, and Evaluation containing 'None'. Purpose and Notes being
// blank."
//
// ⚠️⚠️ NOTES LEFT THE SET ON 2026-09-21, SO REQUIRED IS NOW FOUR: Automation
// Tags, Trigger Event, Evaluation, Purpose. The user rewrote the page subtitle
// as "missing at least one of the 4 required columns ... Please add any other
// supporting information to the entry when possible", and confirmed when asked
// that **Notes is that supporting information**: still worth writing, no longer
// a reason to be on the list.
// 📌 IT MOVED NOBODY. Measured the same day: 927 automations, 536 flagged, and
// **no row was flagged by a single column** (53 miss exactly Evaluation +
// Notes, 483 miss everything), so dropping ANY ONE of the five would have left
// the list at 536. What changed is what the page ASKS FOR - four chips per row,
// four bars in Documentation by Field, one fewer amber field in the dialog.
// ⚠️ A row whose only gap is Notes now stays off the list. There are none
// today; that is the intent of the change, not a side effect of it.
//
// 📌 "None" IS NOT A VALUE. It is the red marker the Per Website table prints
// when a required column is EMPTY (`automations-table-client.tsx`, the red
// `None` span). So "contains None" means "has nothing selected", not "has a
// choice whose text is None". There is no such choice in any of these columns.
//
// ⚠️ AUTHOR IS DELIBERATELY NOT ONE OF THE FIVE. It is not in the user's list,
// and it is empty on 916 of 917 rows, so including it would flag the whole
// estate and drown every other signal. **Do not add it back without being
// asked.**
// ⚠️ NEITHER ARE GHL Tags, GHL Forms OR Webhook Links. Those are conditional by
// nature: an automation with no webhook has nothing to record. That is the same
// test that removed them from "Documentation by Field" in #516.
//
// 📊 WHAT THE RULE SELECTS (927 rows, re-measured 2026-09-21): **536 flagged,
// 391 clean.** The split is bimodal and there is no middle: 483 rows are
// missing ALL FOUR and 53 are missing exactly one (Evaluation), with NOTHING in
// between. Zapier is entirely clean and Make is two rows off it, so in practice
// this page is about n8n, GHL and GHL B2B.
// ---------------------------------------------------------------------------

/** The four columns a person is required to fill in, in the order the Per
 *  Website table shows them. **The labels are what the page prints**, so they
 *  match the table's own column headers rather than the database's names.
 *
 *  🛑 NOTES WAS THE FIFTH UNTIL 2026-09-21; see the header for why it left.
 *  ⭐⭐ NEARLY EVERYTHING THAT SHOWS THE REQUIRED SET MAPS OVER THIS ARRAY - the
 *  row chips, the table's `<colgroup>`, the Housekeeping coverage panel and the
 *  Edit dialog's amber tints - so adding or removing one here moves all of them
 *  at once. **THE TWO IT DOES NOT REACH ARE `flaggedRows()`, the SQL twin of
 *  the function below, and the live hub's own `COVERAGE_FIELDS`.** Both have to
 *  be edited by hand, and both carry a note saying so. */
export const REQUIRED_COLUMNS = [
  "Automation Tags",
  "Trigger Event",
  "Evaluation",
  "Purpose",
] as const;

export type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

/** The shape the rule needs. Deliberately loose so it accepts both the row this
 *  page builds and the `AutomationRow` the Edit dialog hands back on save. */
export interface RuleInput {
  purpose?: string | null;
  // ⚠️ NO `notes` SINCE 2026-09-21. It was removed rather than left unread so
  // that a caller passing it gets a compile error instead of quietly believing
  // the rule still weighs it.
  triggerEventChoiceId?: string | null;
  triageChoiceId?: string | null;
  automationTags?: { id: string }[] | null;
}

/** Which of the four required columns this automation has not had filled in.
 *
 *  ⚠️ BLANK IS NOT THE SAME AS NULL for Purpose, now the only free-text column
 *  in the set: a Purpose of `"   "` is not a filled-in one, and the table would
 *  still print its red "None". `btrim` does the same job in the SQL half of
 *  this rule; the two must agree. */
export function missingRequired(row: RuleInput): RequiredColumn[] {
  const missing: RequiredColumn[] = [];
  if (!row.automationTags || row.automationTags.length === 0)
    missing.push("Automation Tags");
  if (!row.triggerEventChoiceId) missing.push("Trigger Event");
  // "Evaluation" is the user-facing name; `triage` is the internal one. The
  // rename was display-only (2026-08-20) and nothing keyed on the word changed.
  if (!row.triageChoiceId) missing.push("Evaluation");
  if (!row.purpose || row.purpose.trim() === "") missing.push("Purpose");
  return missing;
}
