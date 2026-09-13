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
// 📊 WHAT THE RULE SELECTS (917 rows, measured 2026-09-13): **526 flagged, 391
// clean.** The split is bimodal and there is no middle: 473 rows are missing
// ALL FIVE, 53 are missing exactly two (Evaluation + Notes), and NOTHING is
// missing one, three or four. Zapier is entirely clean and Make is two rows off
// it, so in practice this page is about n8n, GHL and GHL B2B.
// ---------------------------------------------------------------------------

/** The five columns a person is required to fill in, in the order the Per
 *  Website table shows them. **The labels are what the page prints**, so they
 *  match the table's own column headers rather than the database's names. */
export const REQUIRED_COLUMNS = [
  "Automation Tags",
  "Trigger Event",
  "Evaluation",
  "Purpose",
  "Notes",
] as const;

export type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

/** The shape the rule needs. Deliberately loose so it accepts both the row this
 *  page builds and the `AutomationRow` the Edit dialog hands back on save. */
export interface RuleInput {
  purpose?: string | null;
  notes?: string | null;
  triggerEventChoiceId?: string | null;
  triageChoiceId?: string | null;
  automationTags?: { id: string }[] | null;
}

/** Which of the five required columns this automation has not had filled in.
 *
 *  ⚠️ BLANK IS NOT THE SAME AS NULL for the two free-text columns: a Purpose of
 *  `"   "` is not a filled-in one, and the table would still print its red
 *  "None". `btrim` does the same job in the SQL half of this rule; the two must
 *  agree. */
export function missingRequired(row: RuleInput): RequiredColumn[] {
  const missing: RequiredColumn[] = [];
  if (!row.automationTags || row.automationTags.length === 0)
    missing.push("Automation Tags");
  if (!row.triggerEventChoiceId) missing.push("Trigger Event");
  // "Evaluation" is the user-facing name; `triage` is the internal one. The
  // rename was display-only (2026-08-20) and nothing keyed on the word changed.
  if (!row.triageChoiceId) missing.push("Evaluation");
  if (!row.purpose || row.purpose.trim() === "") missing.push("Purpose");
  if (!row.notes || row.notes.trim() === "") missing.push("Notes");
  return missing;
}
