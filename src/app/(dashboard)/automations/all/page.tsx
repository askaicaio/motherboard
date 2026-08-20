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
  const ghlTagsByAutomation = await getSelectionsByColumn(
    "ghl_tags",
    baseRows.map((r) => r.id),
  );
  const ghlFormsByAutomation = await getSelectionsByColumn(
    "ghl_forms",
    baseRows.map((r) => r.id),
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
        .orderBy(asc(automationDropdownChoices.value)),
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
        .orderBy(asc(automationDropdownChoices.value)),
      // Webhook Links (multi-select): its own choices table, so the URL maps to
      // the picker's `value`. Mirrors the per-website page loader exactly.
      db
        .select({
          id: automationWebhookChoices.id,
          value: automationWebhookChoices.url,
        })
        .from(automationWebhookChoices)
        .orderBy(asc(automationWebhookChoices.url)),
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
        <h1 className="text-2xl font-semibold tracking-tight">All Automations</h1>
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
  );
}
