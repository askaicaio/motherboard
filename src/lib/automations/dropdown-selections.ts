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
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
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
  withSharedCounts = false,
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

  // Opt-in "shared with N others" pass, mirroring getWebhooksByAutomation.
  // OPT-IN rather than always-on because it costs an extra aggregate query and
  // only the columns that render a sharing indicator need it (GHL Tags today).
  // Same reasoning as the webhook version: sharing is CROSS-PLATFORM, so it
  // cannot be derived on the client from the rows a page happens to hold.
  if (withSharedCounts) {
    const choiceIds = [...new Set(rows.map((r) => r.id))];
    if (choiceIds.length > 0) {
      const totals = await getSelectionOthersCounts(choiceIds);
      for (const list of map.values()) {
        for (const entry of list) {
          // The junction is unique on (automation_id, choice_id), so a selecting
          // automation is counted exactly once and "others" is exactly total - 1.
          entry.sharedWith = Math.max(0, (totals[entry.id] ?? 1) - 1);
        }
      }
    }
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

  // Attach each webhook's "shared with N others" count so the Webhook Links
  // cells can show a passive shared indicator without opening the dialog.
  //
  // Done HERE rather than in the callers because BOTH row loaders (the Per
  // Website getPerWebsiteRows and the View All Lists page, which has its own
  // query) go through this helper — so both surfaces get the count from one
  // place instead of two.
  //
  // getWebhookOthersCounts with NO excludeAutomationId returns the TOTAL number
  // of automations using each webhook, across every platform. The junction has a
  // uniqueIndex on (automation_id, webhook_choice_id), so a row that uses a
  // webhook is counted exactly once and "others" is precisely total - 1.
  //
  // Sharing is CROSS-PLATFORM, which is why this cannot be derived on the client
  // from the loaded rows: a Make webhook may be shared with an n8n automation
  // that the Per Website page never loads.
  const choiceIds = [...new Set(rows.map((r) => r.id))];
  if (choiceIds.length > 0) {
    const totals = await getWebhookOthersCounts(choiceIds);
    for (const list of map.values()) {
      for (const entry of list) {
        entry.sharedWith = Math.max(0, (totals[entry.id] ?? 1) - 1);
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// RELATED-AUTOMATIONS LOOKUP, the generic (selections junction) side
// ---------------------------------------------------------------------------
// These mirror the three webhook helpers below, but read the GENERIC junction
// automation_dropdown_selections instead of automation_webhooks. Together the
// two sets back one shared dialog + one API route (see
// related-automations-dialog.tsx), so "which other automations share this?" is
// answered the same way for every multi-select column.
//
// ⚠️ NOTE THEY TAKE NO COLUMN KEY. Choice ids are globally unique in
// automation_dropdown_choices, so a choice id already implies its column. Only
// the GROUPED variant needs a column key, because it has no id to start from
// and must decide which choices to include.
// ---------------------------------------------------------------------------

/**
 * For each of `choiceIds`, how many OTHER automations selected that choice
 * (excluding `excludeAutomationId`, the anchor). Omit the exclusion to count
 * ALL selecting automations, which is what the "browse-all" and the passive
 * indicator both want. Keyed by choice id; an unselected choice is absent.
 */
export async function getSelectionOthersCounts(
  choiceIds: string[],
  excludeAutomationId?: string,
): Promise<Record<string, number>> {
  if (choiceIds.length === 0) return {};

  const rows = await db
    .select({
      choiceId: automationDropdownSelections.choiceId,
      n: count(),
    })
    .from(automationDropdownSelections)
    .where(
      and(
        inArray(automationDropdownSelections.choiceId, choiceIds),
        excludeAutomationId
          ? ne(automationDropdownSelections.automationId, excludeAutomationId)
          : undefined,
      ),
    )
    .groupBy(automationDropdownSelections.choiceId);

  const out: Record<string, number> = {};
  for (const r of rows) out[r.choiceId] = r.n;
  return out;
}

/**
 * Every automation that selected `choiceId`, across ALL platforms, resolved for
 * the related list (name / platform / status / link), name-ascending. The caller
 * decides whether to drop the anchor.
 */
export async function getAutomationsBySelection(
  choiceId: string,
): Promise<RelatedAutomation[]> {
  return db
    .select({
      id: automations.id,
      name: automations.name,
      platform: automations.platform,
      status: automations.status,
      externalUrl: automations.externalUrl,
    })
    .from(automationDropdownSelections)
    .innerJoin(
      automations,
      eq(automationDropdownSelections.automationId, automations.id),
    )
    .where(eq(automationDropdownSelections.choiceId, choiceId))
    .orderBy(asc(automations.name));
}

/**
 * Every choice's selecting automations for ONE column, grouped by choice id
 * (name-ascending within each). Powers a Config-page Relationships column.
 * Choices nobody selected are simply absent (an empty list at the call site).
 */
export async function getAutomationsBySelectionGrouped(
  columnKey: string,
): Promise<Map<string, RelatedAutomation[]>> {
  const rows = await db
    .select({
      choiceId: automationDropdownSelections.choiceId,
      id: automations.id,
      name: automations.name,
      platform: automations.platform,
      status: automations.status,
      externalUrl: automations.externalUrl,
    })
    .from(automationDropdownSelections)
    .innerJoin(
      automations,
      eq(automationDropdownSelections.automationId, automations.id),
    )
    .innerJoin(
      automationDropdownChoices,
      eq(automationDropdownSelections.choiceId, automationDropdownChoices.id),
    )
    .where(eq(automationDropdownChoices.columnKey, columnKey))
    .orderBy(asc(automations.name));

  const map = new Map<string, RelatedAutomation[]>();
  for (const r of rows) {
    const entry: RelatedAutomation = {
      id: r.id,
      name: r.name,
      platform: r.platform,
      status: r.status,
      externalUrl: r.externalUrl,
    };
    const list = map.get(r.choiceId);
    if (list) list.push(entry);
    else map.set(r.choiceId, [entry]);
  }
  return map;
}

/**
 * For each of `webhookChoiceIds`, how many OTHER automations use that webhook
 * (i.e. excluding `excludeAutomationId`, the anchor). Keyed by webhook choice id
 * (a plain object so it serializes to the client); a webhook used by no other
 * automation is simply absent (read as 0 at the call site).
 *
 * Powers the "related automations" lookup's stage-1 "shared with N others"
 * badges. It's fetched LIVE when the dialog opens (not snapshotted at page
 * load) so the badge always matches the stage-2 list, which is also live: a
 * page-load count goes stale the moment webhooks are added/removed in-session.
 * Omit `excludeAutomationId` to count ALL users (the Config page browse-all).
 */
export async function getWebhookOthersCounts(
  webhookChoiceIds: string[],
  excludeAutomationId?: string,
): Promise<Record<string, number>> {
  if (webhookChoiceIds.length === 0) return {};

  const rows = await db
    .select({
      webhookChoiceId: automationWebhooks.webhookChoiceId,
      n: count(),
    })
    .from(automationWebhooks)
    .where(
      and(
        inArray(automationWebhooks.webhookChoiceId, webhookChoiceIds),
        excludeAutomationId
          ? ne(automationWebhooks.automationId, excludeAutomationId)
          : undefined,
      ),
    )
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

/**
 * Every webhook choice's related automations, grouped by webhook choice id
 * (name-ascending within each). Powers the Config page Relationships column,
 * which mirrors the Per Website Webhook Links cell (a gold count + the automation
 * links inline). One join over the whole junction; choices nobody uses are
 * simply absent (an empty list at the call site).
 */
export async function getAutomationsByWebhookChoiceGrouped(): Promise<
  Map<string, RelatedAutomation[]>
> {
  const rows = await db
    .select({
      webhookChoiceId: automationWebhooks.webhookChoiceId,
      id: automations.id,
      name: automations.name,
      platform: automations.platform,
      status: automations.status,
      externalUrl: automations.externalUrl,
    })
    .from(automationWebhooks)
    .innerJoin(automations, eq(automationWebhooks.automationId, automations.id))
    .orderBy(asc(automations.name));

  const map = new Map<string, RelatedAutomation[]>();
  for (const r of rows) {
    const entry: RelatedAutomation = {
      id: r.id,
      name: r.name,
      platform: r.platform,
      status: r.status,
      externalUrl: r.externalUrl,
    };
    const list = map.get(r.webhookChoiceId);
    if (list) list.push(entry);
    else map.set(r.webhookChoiceId, [entry]);
  }
  return map;
}
