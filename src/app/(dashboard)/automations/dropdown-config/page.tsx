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
  const automationsByGhlTag = await getAutomationsBySelectionGrouped("ghl_tags");

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
      r.columnKey === "ghl_tags" ? automationsByGhlTag.get(r.id) ?? [] : undefined,
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
       📌 THAT TAB STRIP NO LONGER EXISTS (2026-09-25, replaced by the rail), so
       the problem described above cannot recur. **The scroller stays anyway**:
       the page still has a minimum width, it is just the table that sets it
       now, and every other Automations page scrolls the same way.
       🛑 WHY THE SCROLLER IS HERE AND NOT ON `<main>`: the dashboard layout
       gives `<main>` **`overflow-x-clip`**, which cuts overflow off WITHOUT
       creating a scroll container. That is deliberate and shared by every
       dashboard page (a scroll container there would re-anchor
       `position: sticky`), so each page gets its own scroller.
       📊 WHY THE FLOOR IS 1124px, MEASURED RATHER THAN CALCULATED, 2026-09-25.
       **The TABLE is the binding element now.** The rail is a fixed 260px and
       the gap is 16, so the detail pane reaches the table's own `min-w-[800px]`
       at 1076px of content; plus the 48px of `p-6` that is 1124. Measured by
       pinning the content to a series of widths and reading the scroll
       container: 1100 leaves the table overflowing by 24px, **1124 leaves it at
       exactly 0**.
       ⭐⭐ THE NUMBER BARELY MOVED (1132 -> 1124) BUT THE REASON CHANGED
       COMPLETELY, and the reason is the part that matters. It used to be set by
       the TAB STRIP: seven tabs held one line at 1081px of content and broke at
       1079, so **the NAVIGATION decided how narrow this page could go**. The
       rail replaced that on 2026-09-25 and cannot wrap, so the floor is now a
       function of the DATA - the table's column widths - which is where it
       belongs.
       📌 SO WHAT TO RE-MEASURE HAS CHANGED TOO. Adding, renaming or reordering a
       COLUMN no longer moves this number; the rail just gets one row taller.
       **Changing a table COLUMN WIDTH does**, because the 800px is the sum of
       the first column (400) plus the fixed ones. Re-measure then, and not
       before.
       🛑 THE OLD NOTE WARNED that arithmetic said 1088 and was 7px wrong because
       summing seven buttons accumulates sub-pixel rounding. That trap is gone
       with the strip, but **the habit it taught is not: measure the real
       threshold, do not add up the parts.** */
    <div className="overflow-x-auto">
      <div className="min-w-[1124px] space-y-6 p-6">
        <Link
          href="/automations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Automations
        </Link>

        <DropdownConfigClient
          initialChoices={choices}
          initialWebhooks={webhooks}
        />
      </div>
    </div>
  );
}
