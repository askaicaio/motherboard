// ---------------------------------------------------------------------------
// HOUSEKEEPING ALERTS: the reads behind the page.
//
// ⭐ WHAT THE PAGE IS: every automation with at least one of its five REQUIRED
// columns unfilled. The rule itself lives in `./housekeeping-rule` (no database
// import, so the client can share it); read that file first.
//
// 🛑🛑 IT WAS BUILT WRONG THE FIRST TIME AND THIS IS THE CORRECTION. Shipped
// 2026-09-13 as an EVALUATION-ONLY queue (#532): 810 rows, grouped by the
// Evaluation lifecycle. **The user's actual rule is five columns, not one**, and
// they supplied it right after: "these are the five columns that users are
// required to fill in."
// 📌 WHY I GOT IT WRONG, because the reasoning looked sound at the time: I
// measured every "missing field" candidate, saw each one flagged 473-526 of 917
// rows, concluded a documentation worklist would be a permanent 500-item report,
// and narrowed to the one column with a lifecycle. **The narrowing was mine, not
// theirs.** The 500-row objection was also wrong in a way the numbers now show:
// 473 of those rows are missing ALL FIVE columns, so they are not 500 separate
// chores, they are one untouched backlog that a person clears a website at a
// time. ⚠️ **Measuring a candidate rule tells you its SIZE, not whether the user
// wants it. Ask which columns are required; do not infer it from what the data
// could support.**
//
// ---------------------------------------------------------------------------
// THE READ SHAPE
// ---------------------------------------------------------------------------
// ⚠️ ROWS COME BACK IN THE `AutomationRow` SHAPE THE EDIT DIALOG EXPECTS, not a
// shape of this page's own. The page's whole interaction is "open the row in the
// dialog the website tables already use", so anything less than the full row
// would mean a second, lesser editor. `/automations/all` assembles the same
// shape across all five websites; this follows that page deliberately.
//
// ⚠️⚠️ THE READ BUDGET, because [[db-pool-max-10-fanout]] exists: an eleven-read
// page once took the live hub down against a `max: 10` pool, and the rule from
// it is **keep each concurrent wave at six or fewer.**
//   `getHousekeepingRows`     1 base query, then 4 selection reads that NEED the
//                             ids it returns, so the split is forced, not chosen.
//   `getHousekeepingChoices`  2 reads, independent of both.
// The page runs the two functions in one `Promise.all`, so the peak is the base
// query plus the two choice reads (3), then the four selection reads (4).
// **Never above five concurrent. Do not add a read without re-counting this.**
//
// ⚠️ `getHousekeepingCount` IS A THIRD CALLER AND IT IS NOT FOR THIS PAGE. It
// is ONE aggregate, and it runs on the LIVE HUB, which has a read budget of its
// own and a much tighter one. See its note.
//
// ⚠️ `getHousekeepingCoverage` IS THE FOURTH, and it DOES run on this page. It
// is deliberately ONE query rather than the two the hub's equivalent uses, so
// the opening wave goes to four concurrent (base + two choice reads + this)
// instead of five. See its note for how the junction count was folded in.
// ---------------------------------------------------------------------------

import { alias } from "drizzle-orm/pg-core";
import { asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  automationDropdownChoices,
  automationWebhookChoices,
  automations,
} from "@/lib/db/schema";
import {
  getSelectionsByColumn,
  getWebhooksByAutomation,
} from "@/lib/automations/dropdown-selections";
import {
  WEBHOOK_SCOPE,
  sortSpecialFirst,
} from "@/lib/automations/dropdown-config";
import { missingRequired } from "@/lib/automations/housekeeping-rule";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import type { RequiredColumn } from "@/lib/automations/housekeeping-rule";

/** One row on the page: everything the Edit dialog needs, plus which of the
 *  five required columns are unfilled and which website it belongs to. */
export type HousekeepingRow = Awaited<
  ReturnType<typeof getHousekeepingRows>
>[number];

/** The rule as SQL: at least one of the five required columns unfilled.
 *
 *  ⭐⭐ ONE DEFINITION, TWO CALLERS - the list below, and `getHousekeepingCount`
 *  behind the live hub's toolbar pill. **A second copy of this predicate would
 *  let the hub advertise a number the page does not show**, and that is the kind
 *  of discrepancy nobody reports as a bug because it reads as a stale cache.
 *  📌 The JS half of the rule is `missingRequired` in `./housekeeping-rule`,
 *  which decides WHICH columns a row is missing once it is here. This decides
 *  only WHETHER it comes back at all. **They have to agree**, so a change to one
 *  is a change to both.
 *
 *  ⚠️ THE `automation_tags` HALF IS A `NOT EXISTS`, not a join. Emptiness is
 *  the thing being tested, and a join would drop exactly the rows that qualify.
 *  It also means the flagged set comes back from ONE query instead of fetching
 *  all 917 rows and filtering in JS. */
function flaggedRows() {
  const noTags = sql<boolean>`not exists (
    select 1
    from automation_dropdown_selections s
    join automation_dropdown_choices c on c.id = s.choice_id
    where s.automation_id = ${automations.id} and c.column_key = 'automation_tags'
  )`;
  const blankPurpose = sql<boolean>`(${automations.purpose} is null or btrim(${automations.purpose}) = '')`;
  const blankNotes = sql<boolean>`(${automations.notes} is null or btrim(${automations.notes}) = '')`;

  return or(
    isNull(automations.triggerEventChoiceId),
    isNull(automations.triageChoiceId),
    blankPurpose,
    blankNotes,
    noTags,
  );
}

/** How many automations the page would list, and nothing else about them.
 *
 *  ⭐⭐ THIS IS THE LIVE HUB'S TOOLBAR PILL, added 2026-09-15: "add a red pill
 *  with red text to the right side ... the total number of alerts currently in
 *  the page."
 *
 *  🛑 IT IS NOT `(await getHousekeepingRows()).length`, AND THE DIFFERENCE
 *  MATTERS. That function costs FIVE queries and returns every column the edit
 *  dialog needs for 526 rows; the hub wants one integer. **The hub is the page
 *  that went down against the `max: 10` pool** ([[db-pool-max-10-fanout]]), so
 *  a read added there has to be the cheapest thing that answers the question.
 *  This is one `count(*)` with no join and no ordering.
 *
 *  ⚠️ IT GOES IN WAVE 2 OF THAT PAGE'S TWO WAVES, which had four reads and now
 *  has five. Wave 1 is at the cap of six. Re-read the wave comment there before
 *  moving it. */
export async function getHousekeepingCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(automations)
    .where(flaggedRows());
  return row?.count ?? 0;
}

/** Per-website coverage of the five required columns: how many automations
 *  have each one filled, out of that website's total.
 *
 *  ⭐⭐ THIS IS THE HOUSEKEEPING PAGE'S OWN COPY OF THE HUB'S "Documentation by
 *  Field" PANEL, across the WHOLE ESTATE. The hub's is scoped to one website;
 *  this one sums all five.
 *  🛑 IT WAS FIVE SEPARATE PANELS FOR ONE ROUND (#554, "One statistic of each per
 *  website page, making it 5 total") and the user replaced them the same day:
 *  "seeing it now, the proportions are way too small. So instead, just make it
 *  one statistic that combines all the websites." **Five panels each got a fifth
 *  of the column, so every bar and label was a fifth the size it could be.**
 *  ⚠️ Per-website coverage still exists on the LIVE HUB, one website at a time,
 *  which is where it reads properly. **Do not re-split this one.**
 *
 *  ⚠️⚠️ IT COUNTS EVERY AUTOMATION, NOT THE FLAGGED ONES. `getHousekeepingRows`
 *  returns only rows that are missing something, so it can never supply the
 *  DENOMINATOR here - a website with 115 automations and 2 flagged needs the
 *  115. **Do not try to compute this from the rows the page already has.**
 *
 *  🛑 ONE QUERY, NOT TWO, AND THAT IS A READ-BUDGET DECISION. The hub counts the
 *  multi-select column (Automation Tags) with a separate grouped join against
 *  the junction. Here it is an `exists` inside a `filter`, the same shape
 *  `flaggedRows()` already uses for its `not exists`. **That keeps this page's
 *  opening wave at four concurrent reads instead of five**; see the header.
 *
 *  📌 THE RESULT IS KEYED BY THE COLUMN'S DISPLAY LABEL, straight out of
 *  `REQUIRED_COLUMNS`. It reads oddly for a data structure, and it is on purpose:
 *  **the panel renders by mapping over `REQUIRED_COLUMNS`, so the order and the
 *  names come from one place and cannot drift apart.** */
export async function getHousekeepingCoverage() {
  const hasTag = sql`exists (
    select 1
    from automation_dropdown_selections s
    join automation_dropdown_choices c on c.id = s.choice_id
    where s.automation_id = ${automations.id} and c.column_key = 'automation_tags'
  )`;

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      automationTags: sql<number>`count(*) filter (where ${hasTag})::int`,
      triggerEvent: sql<number>`count(*) filter (where ${automations.triggerEventChoiceId} is not null)::int`,
      triage: sql<number>`count(*) filter (where ${automations.triageChoiceId} is not null)::int`,
      purpose: sql<number>`count(*) filter (where ${automations.purpose} is not null and btrim(${automations.purpose}) <> '')::int`,
      notes: sql<number>`count(*) filter (where ${automations.notes} is not null and btrim(${automations.notes}) <> '')::int`,
    })
    .from(automations);

  return {
    total: row?.total ?? 0,
    filled: {
      "Automation Tags": row?.automationTags ?? 0,
      "Trigger Event": row?.triggerEvent ?? 0,
      Evaluation: row?.triage ?? 0,
      Purpose: row?.purpose ?? 0,
      Notes: row?.notes ?? 0,
    } as Record<RequiredColumn, number>,
  };
}

/** What the coverage panel needs. */
export type HousekeepingCoverage = Awaited<
  ReturnType<typeof getHousekeepingCoverage>
>;

/** Canonical position of a platform in `AUTOMATION_SITES` (Make, n8n, GHL,
 *  GHL B2B, Zapier). Unknown slugs sort last so a platform missing from that
 *  array cannot take the top of the list. */
function siteRank(slug: string): number {
  const i = AUTOMATION_SITES.findIndex((s) => s.slug === slug);
  return i === -1 ? AUTOMATION_SITES.length : i;
}

/** Every automation with at least one required column unfilled.
 *
 *  ⭐⭐ SORTED BY WEBSITE IN CANONICAL ORDER, THEN BY NAME (user, 2026-09-18:
 *  "the entries should be sorted using that same order"). The list now matches
 *  the filter chips above it and the website order every other surface uses.
 *
 *  🛑 IT USED TO SORT FEWEST-MISSING FIRST, and that was ALSO the user's call
 *  ("Nearly done first"), so this reverses an earlier decision rather than
 *  fixing a mistake. **The argument that lost:** the 53 rows missing only
 *  Evaluation and Notes are two fields from done, while the 477 missing all
 *  five are a different kind of job, so fewest-missing surfaced the quick wins
 *  and website-first buries them inside their own block.
 *  ⚠️ CONSEQUENCE, so nobody reports it as a bug: those 53 rows (measured
 *  2026-09-18: **27 n8n and 26 GHL B2B**) now sit inside their own website's
 *  block instead of at the top. **The five `missing` chips on each row are the
 *  only remaining signal of how far along a row is.** */
export async function getHousekeepingRows() {
  const triggerChoices = alias(automationDropdownChoices, "trigger_choices");
  const triageChoices = alias(automationDropdownChoices, "triage_choices");

  const baseRows = await db
    .select({
      id: automations.id,
      platform: automations.platform,
      name: automations.name,
      externalUrl: automations.externalUrl,
      status: automations.status,
      purpose: automations.purpose,
      notes: automations.notes,
      lastRunAt: automations.lastRunAt,
      lastEditedAt: automations.lastEditedAt,
      rowUpdatedAt: automations.rowUpdatedAt,
      authorChoiceId: automations.authorChoiceId,
      author: automationDropdownChoices.value,
      authorBadgeColor: automationDropdownChoices.badgeColor,
      authorTextColor: automationDropdownChoices.textColor,
      triggerEventChoiceId: automations.triggerEventChoiceId,
      triggerEvent: triggerChoices.value,
      triggerEventBadgeColor: triggerChoices.badgeColor,
      triggerEventTextColor: triggerChoices.textColor,
      triageChoiceId: automations.triageChoiceId,
      triage: triageChoices.value,
      triageBadgeColor: triageChoices.badgeColor,
      triageTextColor: triageChoices.textColor,
    })
    .from(automations)
    .leftJoin(
      automationDropdownChoices,
      eq(automations.authorChoiceId, automationDropdownChoices.id),
    )
    .leftJoin(
      triggerChoices,
      eq(automations.triggerEventChoiceId, triggerChoices.id),
    )
    .leftJoin(triageChoices, eq(automations.triageChoiceId, triageChoices.id))
    .where(flaggedRows())
    // 📌 A DETERMINISTIC BASE ONLY. The JS `.sort` at the end of this function
    // is what the page sees, because canonical website order is an array index
    // rather than anything SQL can express without a CASE ladder.
    .orderBy(asc(automations.platform), asc(automations.name));

  const ids = baseRows.map((r) => r.id);

  // ---- Four selection reads, all needing the ids above. See the header. ---
  const [
    tagsByAutomation,
    ghlTagsByAutomation,
    ghlFormsByAutomation,
    webhooksByAutomation,
  ] = await Promise.all([
    getSelectionsByColumn("automation_tags", ids),
    // `withSharedCounts` matches the per-website loader so the dialog's pickers
    // behave identically here; see that loader's own note.
    getSelectionsByColumn("ghl_tags", ids, true),
    getSelectionsByColumn("ghl_forms", ids, true),
    getWebhooksByAutomation(ids),
  ]);

  return baseRows
    .map((r) => {
      const automationTags = tagsByAutomation.get(r.id) ?? [];
      return {
        ...r,
        automationTags,
        ghlTags: ghlTagsByAutomation.get(r.id) ?? [],
        ghlForms: ghlFormsByAutomation.get(r.id) ?? [],
        webhooks: webhooksByAutomation.get(r.id) ?? [],
        missing: missingRequired({ ...r, automationTags }) as RequiredColumn[],
      };
    })
    .sort(
      (a, b) =>
        siteRank(a.platform) - siteRank(b.platform) ||
        a.name.localeCompare(b.name),
    );
}

/** Every choice list the Edit dialog needs, in the same shape and order the
 *  per-website loader and `/automations/all` use.
 *
 *  ⚠️ ONE QUERY, NOT SEVEN. Six of these live in the same table under different
 *  `column_key`s, so they come back together and are grouped in JS. The other
 *  pages issue one query each because they were written before the read budget
 *  mattered; **this page cannot afford that** alongside its four selection
 *  reads. Webhook choices are a different table and stay separate.
 *  📌 `sortSpecialFirst` keeps the built-in placeholders ("No Tag", "No Form")
 *  at the TOP of their pickers, exactly as the other pages do. */
export async function getHousekeepingChoices() {
  const KEYS = [
    "author",
    "trigger_event",
    "triage",
    "automation_tags",
    "ghl_tags",
    "ghl_forms",
  ] as const;

  const [all, webhookChoices] = await Promise.all([
    db
      .select({
        id: automationDropdownChoices.id,
        columnKey: automationDropdownChoices.columnKey,
        value: automationDropdownChoices.value,
        badgeColor: automationDropdownChoices.badgeColor,
        textColor: automationDropdownChoices.textColor,
      })
      .from(automationDropdownChoices)
      // ⚠️ `inArray`, NOT a raw `= any(...)`. Drizzle expands a JS array in a
      // `sql` template into a comma-separated TUPLE, so `any(($1,$2,...))` is a
      // syntax error Postgres reports as "op ANY/ALL (array) requires array on
      // right side". **The page still answered 200 while this threw**, because
      // the failure surfaced as a render error rather than a bad status; that is
      // why it was caught in the dev log and not by the status code.
      .where(inArray(automationDropdownChoices.columnKey, [...KEYS]))
      .orderBy(asc(automationDropdownChoices.value)),
    getWebhookChoices(),
  ]);

  const pick = (key: string) =>
    all
      .filter((c) => c.columnKey === key)
      .map(({ id, value, badgeColor, textColor }) => ({
        id,
        value,
        badgeColor,
        textColor,
      }));

  return {
    authorChoices: pick("author"),
    triggerEventChoices: pick("trigger_event"),
    triageChoices: pick("triage"),
    automationTagChoices: pick("automation_tags"),
    ghlTagChoices: sortSpecialFirst("ghl_tags", pick("ghl_tags")),
    ghlFormChoices: sortSpecialFirst("ghl_forms", pick("ghl_forms")),
    webhookChoices,
  };
}

/** Webhook Links options. Its own table, so its own read.
 *
 *  ⚠️ `sortSpecialFirst` IS NOT OPTIONAL HERE. The built-in "No Path" and
 *  "No Webhook" sit above hundreds of real URLs, and that placement is the only
 *  reason they are findable. Mirrors the per-website loader exactly. */
async function getWebhookChoices() {
  const rows = await db
    .select({
      id: automationWebhookChoices.id,
      value: automationWebhookChoices.url,
    })
    .from(automationWebhookChoices)
    .orderBy(asc(automationWebhookChoices.url));
  return sortSpecialFirst(WEBHOOK_SCOPE, rows);
}
