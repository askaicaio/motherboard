// Automations Dropdown Configuration page. Reached from the "Dropdown
// Configuration" button in the Main Page toolbar strip.
//
// This is a LITERAL route segment (`dropdown-config`), so it takes precedence
// over the sibling `[platform]` dynamic route for this exact path (same pattern
// as `feature-integration` and `all`).
//
// Reads the choice lists for the four generic dropdown columns
// (automation_dropdown_choices, grouped by column_key) plus the webhook URL
// choices (automation_webhook_choices) and hands them to the client, which
// renders one searchable table per column with an Edit-mode add/edit/delete.
//
// NOTE: requires migration 0030 (the two choices tables) to have been run.

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import {
  automationDropdownChoices,
  automationWebhookChoices,
} from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { DropdownConfigClient } from "@/components/automations/dropdown-config-client";
import type {
  DropdownChoiceRow,
  DropdownColumnKey,
  WebhookChoiceRow,
} from "@/lib/automations/dropdown-config";

export const dynamic = "force-dynamic";

export default async function AutomationsDropdownConfigPage() {
  await requireAuth();

  const [choiceRows, webhookRows] = await Promise.all([
    db
      .select({
        id: automationDropdownChoices.id,
        columnKey: automationDropdownChoices.columnKey,
        value: automationDropdownChoices.value,
      })
      .from(automationDropdownChoices)
      .orderBy(asc(automationDropdownChoices.value)),
    db
      .select({
        id: automationWebhookChoices.id,
        url: automationWebhookChoices.url,
      })
      .from(automationWebhookChoices)
      .orderBy(asc(automationWebhookChoices.url)),
  ]);

  const choices: DropdownChoiceRow[] = choiceRows.map((r) => ({
    id: r.id,
    columnKey: r.columnKey as DropdownColumnKey,
    value: r.value,
  }));
  const webhooks: WebhookChoiceRow[] = webhookRows.map((r) => ({
    id: r.id,
    url: r.url,
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

      <DropdownConfigClient initialChoices={choices} initialWebhooks={webhooks} />
    </div>
  );
}
