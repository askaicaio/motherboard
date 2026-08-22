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
  automationDropdownChoices,
  automationWebhookChoices,
} from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { getAutomationSite, isSyncablePlatform } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { getAutoRefreshFor } from "@/lib/automations/autorefresh";
import { getPerWebsiteRows } from "@/lib/automations/per-website-rows";
import { AutomationsTableClient } from "@/components/automations/automations-table-client";

export const dynamic = "force-dynamic";

export default async function AutomationWebsitePage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireAuth();
  const { platform } = await params;
  // ?q= seeds the table's search box (see initialQuery on the client). Read on
  // the SERVER and passed as a prop rather than via useSearchParams(), which
  // would drag a Suspense boundary into the client component for no benefit.
  // Repeated params come back as an array; take the first.
  const { q } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q) ?? "";

  const site = getAutomationSite(platform);
  if (!site) notFound();

  // ALL row loading goes through this ONE helper (see its header comment).
  const rows = await getPerWebsiteRows(site.slug);

  // Options for the single-select dropdowns (managed on the Dropdown
  // Configuration page). Passed to the table's Add/Edit Workflow dialog.
  const [
    authorChoices,
    triggerEventChoices,
    triageChoices,
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
      // Triage (single-select): options for the dialog's dropdown. Seeded by
      // migration 0049; editable on the Dropdown Configuration page like any
      // other choice column.
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
        initialQuery={initialQuery}
        authorChoices={authorChoices}
        triggerEventChoices={triggerEventChoices}
        triageChoices={triageChoices}

        automationTagChoices={automationTagChoices}
        ghlTagChoices={ghlTagChoices}
        ghlFormChoices={ghlFormChoices}
        webhookChoices={webhookChoices}
        canSync={isSyncablePlatform(site.slug)}
        hasApiKey={platformHasApiKey(site.slug)}
        autoRefresh={autoRefresh}
      />
    </div>
  );
}
