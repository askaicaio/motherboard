// =============================================================
// Per Website Page row loader — THE ONE PLACE rows are loaded
// =============================================================
// Returns one platform's automations in the FULL shape the Per Website table
// renders (`AutomationRow` in automations-table-client.tsx): the base columns
// plus the resolved single-select values and their pill colours (Author,
// Trigger Event), the multi-select selections (Automation Tags, GHL Tags, GHL
// Forms, Webhook Links), and the latest captured error date.
//
// ⚠️ READ THIS BEFORE ADDING A ROW-RETURNING CODE PATH ⚠️
// Every surface that hands rows to the Per Website table MUST come through this
// function. Today that is:
//   1. the page server component  — src/app/(dashboard)/automations/[platform]/page.tsx
//   2. the sync route (Refresh List + the silent 24h auto-refresh)
//                                 — src/app/api/automations/sync/route.ts
//   3. the 30s poll               — src/app/api/automations/route.ts (GET, with ?platform=)
//
// WHY THIS FILE EXISTS (regression fixed 2026-08-18): those three paths used to
// run three DIFFERENT queries. The sync route's returned only 7 columns, and the
// client replaces its rows wholesale with the response
// (`setRows(data.rows)`), so clicking "Refresh List" blanked every column the
// short query omitted — Author, Automation Tags, Trigger Event, Notes, GHL Tags,
// GHL Forms, Webhook Links, Last Error. It LOOKED like destructive data loss.
// It was not: the sync writers never touch those columns, the DB was intact and
// a reload restored everything. But it is alarming and it reached production.
//
// The trap is NOT "adding a column". Adding a column here is safe: every
// consumer picks it up automatically, and if you forget, the PAGE renders blank
// too, so you see it immediately in dev instead of only after a refresh click.
// The trap IS writing a NEW endpoint that selects rows itself. `AutomationRow`
// declares almost every field optional, so a short payload still type-checks
// and TypeScript will NOT catch it. If you need rows somewhere new, call this
// function. If you genuinely cannot, you own keeping the shape identical.
// =============================================================

import { db } from "@/lib/db";
import {
  automations,
  automationDropdownChoices,
} from "@/lib/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { getLastErrorAtByPlatform } from "@/lib/automations/errors";
import {
  getSelectionsByColumn,
  getWebhooksByAutomation,
} from "@/lib/automations/dropdown-selections";

/**
 * Load every automation for one platform in the Per Website table's full row
 * shape, ordered by name (the table's default sort).
 *
 * @param platform the platform slug (e.g. "make", "n8n", "ghl", "ghl-b2b")
 */
export async function getPerWebsiteRows(platform: string) {
  // Self-joins of the choices table for the single-select columns. Author uses
  // the unaliased table; Trigger Event and Triage each need their own alias, so
  // all three values resolve in ONE query.
  const triggerChoices = alias(automationDropdownChoices, "trigger_choices");
  const triageChoices = alias(automationDropdownChoices, "triage_choices");


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
      // Author: the stored choice id + its resolved display value (left join,
      // so rows with no author come back null), plus the choice's badge + text
      // colours so the cell can render a coloured pill (mirrors Trigger Event).
      authorChoiceId: automations.authorChoiceId,
      author: automationDropdownChoices.value,
      authorBadgeColor: automationDropdownChoices.badgeColor,
      authorTextColor: automationDropdownChoices.textColor,
      // Trigger Event: same, via the aliased second join, plus the choice's
      // badge + text colours so the cell can render a coloured pill.
      triggerEventChoiceId: automations.triggerEventChoiceId,
      triggerEvent: triggerChoices.value,
      triggerEventBadgeColor: triggerChoices.badgeColor,
      triggerEventTextColor: triggerChoices.textColor,
      // Triage: same shape again (migration 0049). NULL = not yet triaged, which
      // is distinct from the "Unknown" choice.
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

    .where(eq(automations.platform, platform))
    .orderBy(asc(automations.name));

  const ids = baseRows.map((r) => r.id);

  // Latest captured error date per automation, merged onto each row as the
  // "Last Error" column. Comes from the automation_errors table (Make + n8n
  // write it); a row with no captured error is left null and renders "-".
  const lastErrorByAutomation = await getLastErrorAtByPlatform(platform);
  // Automation Tags (multi-select): each row's selected tag choices, rendered
  // as chips. Scoped to this platform's automations.
  const tagsByAutomation = await getSelectionsByColumn("automation_tags", ids);
  // GHL Tags + GHL Forms (multi-select, GHL pages): each row's selected choices.
  // Scoped to this platform's automations; empty maps on non-GHL platforms.
  const ghlTagsByAutomation = await getSelectionsByColumn("ghl_tags", ids);
  const ghlFormsByAutomation = await getSelectionsByColumn("ghl_forms", ids);
  // Webhook Links (multi-select): each row's selected webhooks, via the
  // automation_webhooks junction. Scoped to this platform's automations.
  const webhooksByAutomation = await getWebhooksByAutomation(ids);

  return baseRows.map((r) => ({
    ...r,
    lastErrorAt: lastErrorByAutomation.get(r.id) ?? null,
    automationTags: tagsByAutomation.get(r.id) ?? [],
    ghlTags: ghlTagsByAutomation.get(r.id) ?? [],
    ghlForms: ghlFormsByAutomation.get(r.id) ?? [],
    webhooks: webhooksByAutomation.get(r.id) ?? [],
  }));
}
