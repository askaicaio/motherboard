// Per Website Page, lists the automations tracked from one source website.
// Reached from the Automations Main Page cards ("Open →"). One dynamic route
// serves all five websites; the slug is validated against AUTOMATION_SITES
// (unknown slug → 404). The server fetches this platform's rows and hands
// them to the client table (search + display). Edit-mode toggle, "+ New
// Workflow", and Add/Edit Workflow dialogs land in the next PR.

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { automations, automationDropdownChoices } from "@/lib/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { getAutomationSite, isSyncablePlatform } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { getAutoRefreshFor } from "@/lib/automations/autorefresh";
import { getLastErrorAtByPlatform } from "@/lib/automations/errors";
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
  const [authorChoices, triggerEventChoices] = await Promise.all([
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
  ]);

  // Latest captured error date per automation, merged onto each row as the
  // "Last Error" column. Comes from the automation_errors table (Make writes it
  // today); a row with no captured error is left null and renders "-".
  const lastErrorByAutomation = await getLastErrorAtByPlatform(site.slug);
  const rows = baseRows.map((r) => ({
    ...r,
    lastErrorAt: lastErrorByAutomation.get(r.id) ?? null,
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
        canSync={isSyncablePlatform(site.slug)}
        hasApiKey={platformHasApiKey(site.slug)}
        autoRefresh={autoRefresh}
      />
    </div>
  );
}
