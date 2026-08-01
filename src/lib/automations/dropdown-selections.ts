// Read helper for MULTI-select dropdown columns (Automation Tags first).
//
// Resolves an automation's selected choices for one column from the generic
// junction (automation_dropdown_selections) joined to the choice rows, grouped
// by automation id. Used by the Per Website + View All Lists page loaders to
// hand each row its set of chips. The column is identified by the choice's own
// column_key, so the same junction serves every multi-select column.

import { db } from "@/lib/db";
import {
  automations,
  automationDropdownSelections,
  automationDropdownChoices,
  automationWebhooks,
  automationWebhookChoices,
} from "@/lib/db/schema";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import type {
  RelatedAutomation,
  SelectedChoice,
  SelectedWebhook,
} from "./dropdown-config";

/**
 * Selected choices for `columnKey`, grouped by automation id. Pass a platform's
 * automation ids to scope the read (Per Website page); omit to load across all
 * automations (View All Lists). Choices come back alphabetical by value within
 * each automation.
 */
export async function getSelectionsByColumn(
  columnKey: string,
  automationIds?: string[],
): Promise<Map<string, SelectedChoice[]>> {
  const map = new Map<string, SelectedChoice[]>();
  // An explicit empty id list means "no automations" → nothing to load (and
  // avoids an `IN ()` query).
  if (automationIds && automationIds.length === 0) return map;

  const rows = await db
    .select({
      automationId: automationDropdownSelections.automationId,
      id: automationDropdownChoices.id,
      value: automationDropdownChoices.value,
      badgeColor: automationDropdownChoices.badgeColor,
      textColor: automationDropdownChoices.textColor,
    })
    .from(automationDropdownSelections)
    .innerJoin(
      automationDropdownChoices,
      eq(automationDropdownSelections.choiceId, automationDropdownChoices.id),
    )
    .where(
      and(
        eq(automationDropdownChoices.columnKey, columnKey),
        automationIds
          ? inArray(automationDropdownSelections.automationId, automationIds)
          : undefined,
      ),
    )
    .orderBy(asc(automationDropdownChoices.value));

  for (const r of rows) {
    const list = map.get(r.automationId);
    const entry: SelectedChoice = {
      id: r.id,
      value: r.value,
      badgeColor: r.badgeColor,
      textColor: r.textColor,
    };
    if (list) list.push(entry);
    else map.set(r.automationId, [entry]);
  }
  return map;
}

/**
 * Webhooks each automation uses (the Webhook Links column), grouped by
 * automation id, from the `automation_webhooks` junction (SEPARATE from the
 * generic selections junction, since Webhook Links has its own choices table).
 * Pass a platform's automation ids to scope (Per Website page); omit to load
 * across all automations (View All Lists). URLs come back alphabetical within
 * each automation.
 */
export async function getWebhooksByAutomation(
  automationIds?: string[],
): Promise<Map<string, SelectedWebhook[]>> {
  const map = new Map<string, SelectedWebhook[]>();
  if (automationIds && automationIds.length === 0) return map;

  const rows = await db
    .select({
      automationId: automationWebhooks.automationId,
      id: automationWebhookChoices.id,
      url: automationWebhookChoices.url,
    })
    .from(automationWebhooks)
    .innerJoin(
      automationWebhookChoices,
      eq(automationWebhooks.webhookChoiceId, automationWebhookChoices.id),
    )
    .where(
      automationIds
        ? inArray(automationWebhooks.automationId, automationIds)
        : undefined,
    )
    .orderBy(asc(automationWebhookChoices.url));

  for (const r of rows) {
    const list = map.get(r.automationId);
    const entry: SelectedWebhook = { id: r.id, url: r.url };
    if (list) list.push(entry);
    else map.set(r.automationId, [entry]);
  }
  return map;
}

/**
 * How many automations use each webhook, keyed by webhook choice id (a plain
 * object so it serializes to the client). Powers the Webhook Links "related
 * automations" lookup: the stage-1 "shared with N others" badges (N = this
 * count minus the anchor automation itself) and the Config page Relationships
 * column. One grouped query over the whole junction; webhooks nobody uses are
 * simply absent (read as 0 at the call site).
 */
export async function getWebhookUsageCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      webhookChoiceId: automationWebhooks.webhookChoiceId,
      n: count(),
    })
    .from(automationWebhooks)
    .groupBy(automationWebhooks.webhookChoiceId);

  const out: Record<string, number> = {};
  for (const r of rows) out[r.webhookChoiceId] = r.n;
  return out;
}

/**
 * Every automation that uses `webhookChoiceId`, across ALL platforms, resolved
 * for the "related automations" list (name / platform / status / link),
 * name-ascending. The caller decides whether to exclude the anchor automation
 * (Model A "others only" in the anchored flow; no exclusion for the Config page
 * browse-all). Reverse lookup on the indexed junction column.
 */
export async function getAutomationsByWebhook(
  webhookChoiceId: string,
): Promise<RelatedAutomation[]> {
  const rows = await db
    .select({
      id: automations.id,
      name: automations.name,
      platform: automations.platform,
      status: automations.status,
      externalUrl: automations.externalUrl,
    })
    .from(automationWebhooks)
    .innerJoin(automations, eq(automationWebhooks.automationId, automations.id))
    .where(eq(automationWebhooks.webhookChoiceId, webhookChoiceId))
    .orderBy(asc(automations.name));

  return rows;
}
