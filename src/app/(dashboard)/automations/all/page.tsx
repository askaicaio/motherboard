// "Everything Table" — every automation across all 5 websites in one combined,
// read-only table. Reached from the Main Page "View All Lists" toolbar button.
//
// LITERAL route segment (`all`), so it takes precedence over the sibling
// `[platform]` dynamic route for this exact path.
//
// The heavy lifting (search / sort / display) is in AllAutomationsTableClient,
// which mirrors the Per Website Page table minus the per-platform toolbar and
// edit/delete, plus a Website column. This server shell just loads every
// platform's rows + their latest error date.

import Link from "next/link";
import { db } from "@/lib/db";
import { automations, automationDropdownChoices } from "@/lib/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { getLastErrorAtAllAutomations } from "@/lib/automations/errors";
import {
  getSelectionsByColumn,
  getWebhooksByAutomation,
  getWebhookUsageCounts,
} from "@/lib/automations/dropdown-selections";
import { AllAutomationsTableClient } from "@/components/automations/all-automations-table-client";

export const dynamic = "force-dynamic";

export default async function AllAutomationsPage() {
  await requireAuth();

  // Every automation, all platforms, name-ascending (the client re-sorts).
  // Second self-join of the choices table for Trigger Event (Author already
  // joins it unaliased).
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
  // Webhook usage counts (across all platforms), for the "related automations"
  // lookup's stage-1 "shared with N others" badges.
  const webhookUsageCounts = await getWebhookUsageCounts();
  const rows = baseRows.map((r) => ({
    ...r,
    lastErrorAt: lastErrorByAutomation.get(r.id) ?? null,
    automationTags: tagsByAutomation.get(r.id) ?? [],
    ghlTags: ghlTagsByAutomation.get(r.id) ?? [],
    ghlForms: ghlFormsByAutomation.get(r.id) ?? [],
    webhooks: webhooksByAutomation.get(r.id) ?? [],
  }));

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
        webhookUsageCounts={webhookUsageCounts}
      />
    </div>
  );
}
