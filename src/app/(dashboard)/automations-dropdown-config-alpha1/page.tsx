// =============================================================
// Dropdown Config "Alpha1", route /automations-dropdown-config-alpha1
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE DROPDOWN CONFIGURATION PAGE: **Master and detail**.
// One of six created together on 2026-09-25, after the user asked for other
// ways to lay this page out: "Can you suggest other better ways to layout the
// UI on this page? How many Alpha pages can you create so i can see the
// samples?"
//
// ⚠️⚠️ THE DATA AND THE BEHAVIOUR ARE THE LIVE PAGE'S, UNCHANGED. Same four
// queries, same CRUD handlers, same dialog, same API routes. **ONLY THE LAYOUT
// DIFFERS.** If you are changing what a save does, you are editing the wrong
// page - that belongs on the live one.
//
// 📌 WHY SIX: the page serves THREE different data shapes through one table.
// Four colour sets (Author 1, Automation Tags 11, Trigger Event 15, Evaluation
// 5) want to look like swatches; two synced status lists (GHL Tags **428**, GHL
// Forms 45) want to look like a triage queue; Webhook Links (77) is a link
// list. **One table cannot be right for all three**, and each of these six
// answers that differently.
//
// ⚠️ IT IS A BENCH. The live page at `/automations/dropdown-config` is
// untouched and stays that way unless the user picks a winner.
//
// ⬇️ EVERYTHING BELOW IS THE LIVE PAGE'S OWN HEADER, INHERITED WITH THE COPY.
// =============================================================
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
import {
  getAutomationsByWebhookChoiceGrouped,
  getAutomationsBySelectionGrouped,
} from "@/lib/automations/dropdown-selections";
import { DropdownConfigAlpha1Client } from "./dropdown-config-client";
import type {
  DropdownChoiceRow,
  DropdownColumnKey,
  WebhookChoiceRow,
} from "@/lib/automations/dropdown-config";

export const dynamic = "force-dynamic";

export default async function AutomationsDropdownConfigAlpha1Page() {
  await requireAuth();

  const [choiceRows, webhookRows] = await Promise.all([
    db
      .select({
        id: automationDropdownChoices.id,
        columnKey: automationDropdownChoices.columnKey,
        value: automationDropdownChoices.value,
        status: automationDropdownChoices.status,
        notes: automationDropdownChoices.notes,
        badgeColor: automationDropdownChoices.badgeColor,
        textColor: automationDropdownChoices.textColor,
      })
      .from(automationDropdownChoices)
      .orderBy(asc(automationDropdownChoices.value)),
    db
      .select({
        id: automationWebhookChoices.id,
        url: automationWebhookChoices.url,
        notes: automationWebhookChoices.notes,
      })
      .from(automationWebhookChoices)
      .orderBy(asc(automationWebhookChoices.url)),
  ]);

  // Relationships: the automations that use each webhook (reverse lookup),
  // grouped by webhook choice id. Powers the Relationships column, which shows a
  // gold count + the automation links inline (mirrors the Per Website Webhook
  // Links cell); the count is just the list length.
  const automationsByWebhook = await getAutomationsByWebhookChoiceGrouped();

  // Same reverse lookup for GHL Tags, off the GENERIC selections junction. Only
  // GHL Tags is loaded because it is the only choice column with a Relationships
  // column today; the other multi-selects would each cost another join.
  const automationsByGhlTag =
    await getAutomationsBySelectionGrouped("ghl_tags");

  const choices: DropdownChoiceRow[] = choiceRows.map((r) => ({
    id: r.id,
    columnKey: r.columnKey as DropdownColumnKey,
    value: r.value,
    status: r.status,
    notes: r.notes,
    badgeColor: r.badgeColor,
    textColor: r.textColor,
    // Only GHL Tags renders a Relationships column, so only it carries the list.
    relatedAutomations:
      r.columnKey === "ghl_tags"
        ? (automationsByGhlTag.get(r.id) ?? [])
        : undefined,
  }));
  const webhooks: WebhookChoiceRow[] = webhookRows.map((r) => {
    const related = automationsByWebhook.get(r.id) ?? [];
    return {
      id: r.id,
      url: r.url,
      notes: r.notes,
      relationships: related.length,
      relatedAutomations: related,
    };
  });

  return (
    /* ⭐⭐ THE PAGE KEEPS ITS WIDTH AND SCROLLS SIDEWAYS, 2026-09-23. Third page
       to get this treatment, after Housekeeping (#572) and the hub (#576),
       during the narrow-window pass. The user saw the tab strip wrapped into
       four ragged rows and asked for this page next; offered a scrolling tab
       strip or moving the Edit mode toggle, **they chose the whole page
       scrolling**, matching the other two.
       🛑 WHY THE SCROLLER IS HERE AND NOT ON `<main>`: the dashboard layout
       gives `<main>` **`overflow-x-clip`**, which cuts overflow off WITHOUT
       creating a scroll container. That is deliberate and shared by every
       dashboard page (a scroll container there would re-anchor
       `position: sticky`), so each page gets its own scroller.
       🛑 THE FLOOR BELOW IS INHERITED AND IS NOW LOOSER THAN IT NEEDS TO BE.
       This bench kept the live page's 1132px, which was set by the TAB STRIP.
       The rail replaced that strip, so the real minimum here is the same 1124
       the live page measured on 2026-09-25 (rail 260 + gap 16 + the table's own
       800, plus 48 of `p-6`). **8px of slack, left alone on purpose**: this is a
       bench, the number is harmless, and re-measuring every bench each time the
       live page moves is not worth it. The paragraph below describes the strip
       that no longer exists on either page; it is kept because it records HOW
       the number was arrived at.
       📊 WHY THE FLOOR WAS 1132px, BISECTED RATHER THAN CALCULATED. **The TAB
       STRIP is the binding element on this page, not the table** - the table
       card carries `min-w-[800px]` inside its own `overflow-auto`, so it never
       forces the page wider. The strip is `flex-wrap`, and it holds one line at
       **1081px of content and breaks at 1079**. 1084 + the 48px of `p-6` is
       1132, so the scrollbar appears at about a 1420px window.
       ⚠️ ARITHMETIC SAID 1088 AND WAS 7px WRONG: summing the seven buttons'
       measured widths accumulates sub-pixel rounding. **Bisect the real wrap
       instead**, one pixel either side.
       ⚠️ WHY WRAPPING LOOKED WORSE THAN IT WAS: the `border-b` is on the
       CONTAINER while the active tab's underline is on the BUTTON, so the
       moment the strip wraps the underline detaches from the bottom border and
       floats a row or two above it. **A wrapped row of tabs here can never look
       right**, which is why holding it on one line is the fix rather than
       styling the wrap.
       📌 THE FLOOR IS A FUNCTION OF THE SEVEN TAB LABELS AND THEIR COUNT PILLS.
       Those counts are live (GHL Tags was 428 when measured), so **a jump to
       four digits widens the strip a few px per tab**. Re-bisect if a tab is
       added, renamed, or its count changes order of magnitude. */
    <div className="overflow-x-auto">
      <div className="min-w-[1132px] space-y-6 p-6">
        <Link
          href="/automations/dropdown-config"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dropdown Configuration
        </Link>

        <DropdownConfigAlpha1Client
          initialChoices={choices}
          initialWebhooks={webhooks}
        />
      </div>
    </div>
  );
}
