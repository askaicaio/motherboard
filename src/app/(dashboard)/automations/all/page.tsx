// "Everything Table" — every automation across all 5 websites in one combined,
// read-only table. Reached from the Main Page "View All Lists" toolbar button.
//
// LITERAL route segment (`all`), so it takes precedence over the sibling
// `[platform]` dynamic route for this exact path.
//
// The heavy lifting (search / sort / display / edit) is in
// AllAutomationsTableClient, which mirrors the Per Website Page table minus the
// per-platform toolbar (Auto-refresh / Refresh List / Export CSV) and minus
// CREATE, plus a Website column. This server shell loads every platform's rows,
// their latest error date, and the dropdown choice lists.
//
// ⚠️ The choice lists below are GLOBAL, not per-platform:
// automation_dropdown_choices is keyed by column_key alone. That is why one
// cross-platform table can drive the same Edit dialog the per-platform pages
// use. The only per-row thing the dialog needs is r.platform, which decides
// whether the GHL Tags / GHL Forms fields are shown.

import Link from "next/link";
import { db } from "@/lib/db";
import {
  automations,
  automationDropdownChoices,
  automationWebhookChoices,
} from "@/lib/db/schema";
import {
  WEBHOOK_SCOPE,
  sortSpecialFirst,
} from "@/lib/automations/dropdown-config";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { getLastErrorAtAllAutomations } from "@/lib/automations/errors";
import {
  getSelectionsByColumn,
  getWebhooksByAutomation,
} from "@/lib/automations/dropdown-selections";
import { AllAutomationsTableClient } from "@/components/automations/all-automations-table-client";

export const dynamic = "force-dynamic";

export default async function AllAutomationsPage() {
  await requireAuth();

  // Every automation, all platforms, name-ascending (the client re-sorts).
  // Second self-join of the choices table for Trigger Event (Author already
  // joins it unaliased).
  const triggerChoices = alias(automationDropdownChoices, "trigger_choices");
  const triageChoicesTbl = alias(automationDropdownChoices, "triage_choices");


  const baseRows = await db
    .select({
      id: automations.id,
      name: automations.name,
      externalUrl: automations.externalUrl,
      status: automations.status,
      purpose: automations.purpose,
      notes: automations.notes,
      lastRunAt: automations.lastRunAt,
      lastEditedAt: automations.lastEditedAt,
      // "Row Update" (migration 0050): when a person last touched this row in
      // the app. Keep in step with getPerWebsiteRows, which selects it too.
      rowUpdatedAt: automations.rowUpdatedAt,
      platform: automations.platform,
      // Author: stored id + resolved display value (left join → null when unset),
      // plus its badge + text colours so the cell can render a coloured pill.
      authorChoiceId: automations.authorChoiceId,
      author: automationDropdownChoices.value,
      authorBadgeColor: automationDropdownChoices.badgeColor,
      authorTextColor: automationDropdownChoices.textColor,
      // Trigger Event: same, via the aliased second join, plus its badge + text
      // colours so the cell can render a coloured pill.
      triggerEventChoiceId: automations.triggerEventChoiceId,
      triggerEvent: triggerChoices.value,
      triggerEventBadgeColor: triggerChoices.badgeColor,
      triggerEventTextColor: triggerChoices.textColor,
      // Triage: third aliased join (migration 0049). NULL = not yet triaged,
      // distinct from the "Unknown" choice.
      triageChoiceId: automations.triageChoiceId,
      triage: triageChoicesTbl.value,
      triageBadgeColor: triageChoicesTbl.badgeColor,
      triageTextColor: triageChoicesTbl.textColor,
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
    .leftJoin(
      triageChoicesTbl,
      eq(automations.triageChoiceId, triageChoicesTbl.id),
    )
    .orderBy(asc(automations.name));


  // Latest captured error per automation (across all platforms) → Last Error.
  const lastErrorByAutomation = await getLastErrorAtAllAutomations();
  // Automation Tags (multi-select): each row's selected tag choices as chips.
  const tagsByAutomation = await getSelectionsByColumn(
    "automation_tags",
    baseRows.map((r) => r.id),
  );
  // GHL Tags + GHL Forms (multi-select, GHL rows only): each row's selected
  // choices. Non-GHL rows simply have none (the cell shows a muted "-").
  //
  // BOTH pass withSharedCounts=true so each choice carries how many OTHER
  // automations use it. GHL Tags needs it for the passive share icon AND the
  // shared-first sort; GHL Forms only for the sort (it renders no share icon),
  // added 2026-08-29. Kept in step with the per-website loader.
  const ghlTagsByAutomation = await getSelectionsByColumn(
    "ghl_tags",
    baseRows.map((r) => r.id),
    true,
  );
  const ghlFormsByAutomation = await getSelectionsByColumn(
    "ghl_forms",
    baseRows.map((r) => r.id),
    true,
  );
  // Webhook Links (multi-select): each row's selected webhooks (junction).
  const webhooksByAutomation = await getWebhooksByAutomation(
    baseRows.map((r) => r.id),
  );
  const rows = baseRows.map((r) => ({
    ...r,
    lastErrorAt: lastErrorByAutomation.get(r.id) ?? null,
    automationTags: tagsByAutomation.get(r.id) ?? [],
    ghlTags: ghlTagsByAutomation.get(r.id) ?? [],
    ghlForms: ghlFormsByAutomation.get(r.id) ?? [],
    webhooks: webhooksByAutomation.get(r.id) ?? [],
  }));

  // Choice lists from the Dropdown Config Page, value-ascending, in the same
  // shape/order the per-website loader uses. The first four also drive the
  // Filter menu's dimensions; the last three exist only for the Edit dialog.
  const [
    authorChoices,
    triggerEventChoices,
    triageChoices,
    automationTagChoices,
    ghlTagChoices,
    ghlFormChoices,
    webhookChoices,
  ] =

    await Promise.all([
      db
        .select({
          id: automationDropdownChoices.id,
          value: automationDropdownChoices.value,
          badgeColor: automationDropdownChoices.badgeColor,
          textColor: automationDropdownChoices.textColor,
        })
        .from(automationDropdownChoices)
        .where(eq(automationDropdownChoices.columnKey, "author"))
        .orderBy(asc(automationDropdownChoices.value)),
      db
        .select({
          id: automationDropdownChoices.id,
          value: automationDropdownChoices.value,
          badgeColor: automationDropdownChoices.badgeColor,
          textColor: automationDropdownChoices.textColor,
        })
        .from(automationDropdownChoices)
        .where(eq(automationDropdownChoices.columnKey, "trigger_event"))
        .orderBy(asc(automationDropdownChoices.value)),
      // Triage options (single-select), for the Filter menu's Triage dimension.
      db
        .select({
          id: automationDropdownChoices.id,
          value: automationDropdownChoices.value,
          badgeColor: automationDropdownChoices.badgeColor,
          textColor: automationDropdownChoices.textColor,
        })
        .from(automationDropdownChoices)
        .where(eq(automationDropdownChoices.columnKey, "triage"))
        .orderBy(asc(automationDropdownChoices.value)),

      db
        .select({
          id: automationDropdownChoices.id,
          value: automationDropdownChoices.value,
          badgeColor: automationDropdownChoices.badgeColor,
          textColor: automationDropdownChoices.textColor,
        })
        .from(automationDropdownChoices)
        .where(eq(automationDropdownChoices.columnKey, "automation_tags"))
        .orderBy(asc(automationDropdownChoices.value)),
      // GHL Tags (multi-select): options for the Edit dialog's picker. Loaded
      // for every row regardless of platform; the dialog itself only shows the
      // field when that row's platform is a GHL one.
      db
        .select({
          id: automationDropdownChoices.id,
          value: automationDropdownChoices.value,
          badgeColor: automationDropdownChoices.badgeColor,
          textColor: automationDropdownChoices.textColor,
        })
        .from(automationDropdownChoices)
        .where(eq(automationDropdownChoices.columnKey, "ghl_tags"))
        .orderBy(asc(automationDropdownChoices.value))
        // Built-in options ("No Tag") sit at the TOP of the picker; everything
        // else keeps the alphabetical order above. See SPECIAL_CHOICES.
        .then((rows) => sortSpecialFirst("ghl_tags", rows)),
      // GHL Forms (multi-select): same treatment as GHL Tags.
      db
        .select({
          id: automationDropdownChoices.id,
          value: automationDropdownChoices.value,
          badgeColor: automationDropdownChoices.badgeColor,
          textColor: automationDropdownChoices.textColor,
        })
        .from(automationDropdownChoices)
        .where(eq(automationDropdownChoices.columnKey, "ghl_forms"))
        .orderBy(asc(automationDropdownChoices.value))
        // Built-in options ("No Form") sit at the top, as with GHL Tags.
        .then((rows) => sortSpecialFirst("ghl_forms", rows)),
      // Webhook Links (multi-select): its own choices table, so the URL maps to
      // the picker's `value`. Mirrors the per-website page loader exactly.
      db
        .select({
          id: automationWebhookChoices.id,
          value: automationWebhookChoices.url,
        })
        .from(automationWebhookChoices)
        .orderBy(asc(automationWebhookChoices.url))
        // Built-in options ("No Path", "No Webhook") sit at the top, above the
        // hundreds of real URLs, which is the whole reason they are findable.
        .then((rows) => sortSpecialFirst(WEBHOOK_SCOPE, rows)),
    ]);

  return (
    /* ⭐⭐ THE PAGE KEEPS ITS WIDTH AND SCROLLS SIDEWAYS, 2026-09-23. Fourth page
       to get this treatment, after Housekeeping (#572), the hub (#576) and
       Dropdown Config (#577), during the narrow-window pass. The user showed
       the toolbar with the SEARCH FIELD COLLAPSED TO A STUB beside the Columns
       button and asked for this page next.
       🛑 WHY THE SCROLLER IS HERE AND NOT ON `<main>`: the dashboard layout
       gives `<main>` **`overflow-x-clip`**, which cuts overflow off WITHOUT
       creating a scroll container. Deliberate and shared by every dashboard
       page (a scroll container there would re-anchor `position: sticky`), so
       each page gets its own scroller.
       📊 WHY THE FLOOR IS 875px, AND WHY ALL THREE TABLE PAGES SHARE IT.
       2026-09-24: "the table width squishes too much, make the smallest width
       wider." **The floor is now set by HOW MUCH TABLE STAYS VISIBLE**, not by
       the page chrome, and 827 of table is the number because **that is
       Housekeeping's table card**, a width the user had already approved. 827 +
       the 48px of `p-6` = 875, the same floor Housekeeping carries. All three
       table pages were raised to it together so the tab has ONE table minimum.
       The scrollbar appears at about a 1178px window.
       🛑 THE FIRST FLOOR HERE WAS 673 AND IT WAS TOO TIGHT. I reasoned that the
       table "is 2974px wide and scrolls inside its OWN card at every width by
       design, so it can never drive a floor", set the floor from the TOOLBAR
       instead, and shipped a 625px card showing Name + Website + Status. **The
       user photographed exactly that and called it squished.** ⭐ THE LESSON: a
       scrolling table cannot set a MAXIMUM, but it absolutely sets a MINIMUM -
       "it scrolls anyway" is not a reason to let it get as narrow as the rest of
       the page allows. HOW MUCH of it you see is a design decision, not a
       leftover.
       📌 WHAT 827 BUYS ON THIS PAGE, measured column by column: Name 400,
       +Website 509, +Status 610, **+Author 770**, +Automation Tags 1010,
       +Trigger Event 1170. So 827 clears Author with room to spare and no
       longer clips Status.
       📌 THE OLD TOOLBAR FLOOR STILL MATTERS AS A LOWER BOUND, so keep it:
       the search is `min-w-0 flex-1` beside a `shrink-0` 347px action group,
       so **search = content - 355**, and it needs 270px to show its placeholder
       = 625 of content. **875 clears that by 202px**; if the floor is ever cut,
       673 is the hard bottom.
       ⚠️ 270 IS ONLY RIGHT ABOVE THE `md` BREAKPOINT. The Input is
       `text-base md:text-sm`, so under a 768px window the font jumps to 16px
       and the same placeholder needs **305px**. The floor sits above 768, so
       270 is the number that applies; measure the placeholder at the width you
       are flooring for, not at a narrow one.
       📌 IF THE ACTION GROUP GAINS A BUTTON, THE FLOOR FOLLOWS IT. 347px is
       Columns + Filter + Edit mode as of today. */
    <div className="overflow-x-auto">
      <div className="min-w-[875px] space-y-6 p-6">
        <Link
          href="/automations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Automations
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            All Automations
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every automation from all connected websites in one table.
          </p>
        </div>

        <AllAutomationsTableClient
          rows={rows}
          authorChoices={authorChoices}
          triggerEventChoices={triggerEventChoices}
          triageChoices={triageChoices}

          automationTagChoices={automationTagChoices}
          ghlTagChoices={ghlTagChoices}
          ghlFormChoices={ghlFormChoices}
          webhookChoices={webhookChoices}
        />
      </div>
    </div>
  );
}
