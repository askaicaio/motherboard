// Per Website Page, lists the automations tracked from one source website.
// Reached from the Automations Main Page cards ("Open →"). One dynamic route
// serves all five websites; the slug is validated against AUTOMATION_SITES
// (unknown slug → 404). The server fetches this platform's rows and hands
// them to the client table (search + display). Edit-mode toggle, "+ New
// Workflow", and Add/Edit Workflow dialogs land in the next PR.

import Link from "next/link";
import { notFound } from "next/navigation";
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
import { getAutomationSite, isSyncablePlatform } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { getAutoRefreshFor } from "@/lib/automations/autorefresh";
import { getLastErrorAtByPlatform } from "@/lib/automations/errors";
import {
  getSelectionsByColumn,
  getWebhooksByAutomation,
  getWebhookUsageCounts,
} from "@/lib/automations/dropdown-selections";
import { AutomationsTableClient } from "@/components/automations/automations-table-client";

export const dynamic = "force-dynamic";

export default async function AutomationWebsitePage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  await requireAuth();
  const { platform } = await params;

  const site = getAutomationSite(platform);
  if (!site) notFound();

  // Second self-join of the choices table for Trigger Event (Author already
  // joins it unaliased), so both single-select values resolve in one query.
  const triggerChoices = alias(automationDropdownChoices, "trigger_choices");

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
    .where(eq(automations.platform, site.slug))
    .orderBy(asc(automations.name));

  // Options for the single-select dropdowns (managed on the Dropdown
  // Configuration page). Passed to the table's Add/Edit Workflow dialog.
  const [
    authorChoices,
    triggerEventChoices,
    automationTagChoices,
    ghlTagChoices,
    ghlFormChoices,
    webhookChoices,
  ] = await Promise.all([
      db
        .select({
          id: automationDropdownChoices.id,
          value: automationDropdownChoices.value,
          // Author now carries colours too, so the picker shows its pill.
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
      // Automation Tags (multi-select): the options for the dialog's chip picker.
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
      // GHL Tags (multi-select): options for the dialog's picker (GHL pages only,
      // but loaded regardless; the dialog only shows the field on GHL platforms).
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
      // GHL Forms (multi-select): options for the dialog's picker.
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
      // Webhook Links (multi-select): options for the dialog's chip picker. Maps
      // the webhook URL to the picker's `value` (its own choices table).
      db
        .select({
          id: automationWebhookChoices.id,
          value: automationWebhookChoices.url,
        })
        .from(automationWebhookChoices)
        .orderBy(asc(automationWebhookChoices.url)),
    ]);

  // Latest captured error date per automation, merged onto each row as the
  // "Last Error" column. Comes from the automation_errors table (Make writes it
  // today); a row with no captured error is left null and renders "-".
  const lastErrorByAutomation = await getLastErrorAtByPlatform(site.slug);
  // Automation Tags (multi-select): each row's selected tag choices, rendered
  // as chips. Scoped to this platform's automations.
  const tagsByAutomation = await getSelectionsByColumn(
    "automation_tags",
    baseRows.map((r) => r.id),
  );
  // GHL Tags + GHL Forms (multi-select, GHL pages): each row's selected choices.
  // Scoped to this platform's automations; empty maps on non-GHL platforms.
  const ghlTagsByAutomation = await getSelectionsByColumn(
    "ghl_tags",
    baseRows.map((r) => r.id),
  );
  const ghlFormsByAutomation = await getSelectionsByColumn(
    "ghl_forms",
    baseRows.map((r) => r.id),
  );
  // Webhook Links (multi-select): each row's selected webhooks, via the
  // automation_webhooks junction. Scoped to this platform's automations.
  const webhooksByAutomation = await getWebhooksByAutomation(
    baseRows.map((r) => r.id),
  );
  // How many automations use each webhook (across ALL platforms), for the
  // "related automations" lookup's stage-1 "shared with N others" badges.
  const webhookUsageCounts = await getWebhookUsageCounts();
  const rows = baseRows.map((r) => ({
    ...r,
    lastErrorAt: lastErrorByAutomation.get(r.id) ?? null,
    automationTags: tagsByAutomation.get(r.id) ?? [],
    ghlTags: ghlTagsByAutomation.get(r.id) ?? [],
    ghlForms: ghlFormsByAutomation.get(r.id) ?? [],
    webhooks: webhooksByAutomation.get(r.id) ?? [],
  }));

  const autoRefresh = await getAutoRefreshFor(site.slug);

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/automations"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Automations
      </Link>

      <AutomationsTableClient
        platform={site.slug}
        label={site.label}
        description={site.description}
        icon={site.icon}
        iconColor={site.iconColor}
        initialRows={rows}
        authorChoices={authorChoices}
        triggerEventChoices={triggerEventChoices}
        automationTagChoices={automationTagChoices}
        ghlTagChoices={ghlTagChoices}
        ghlFormChoices={ghlFormChoices}
        webhookChoices={webhookChoices}
        webhookUsageCounts={webhookUsageCounts}
        canSync={isSyncablePlatform(site.slug)}
        hasApiKey={platformHasApiKey(site.slug)}
        autoRefresh={autoRefresh}
      />
    </div>
  );
}
