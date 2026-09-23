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
import {
  WEBHOOK_SCOPE,
  sortSpecialFirst,
} from "@/lib/automations/dropdown-config";
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
        .orderBy(asc(automationDropdownChoices.value))
        // Built-in options ("No Tag") sit at the TOP of the picker; everything
        // else keeps the alphabetical order above. See SPECIAL_CHOICES.
        .then((rows) => sortSpecialFirst("ghl_tags", rows)),
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
        .orderBy(asc(automationDropdownChoices.value))
        // Built-in options ("No Form") sit at the top, as with GHL Tags.
        .then((rows) => sortSpecialFirst("ghl_forms", rows)),
      // Webhook Links (multi-select): options for the dialog's chip picker. Maps
      // the webhook URL to the picker's `value` (its own choices table).
      db
        .select({
          id: automationWebhookChoices.id,
          value: automationWebhookChoices.url,
        })
        .from(automationWebhookChoices)
        .orderBy(asc(automationWebhookChoices.url))
        // Built-in options ("No Path", "No Webhook") sit at the top, above the
        // hundreds of real URLs, which is the whole reason they are findable.
        .then((rows) => sortSpecialFirst(WEBHOOK_SCOPE, rows)),
    ]);

  const autoRefresh = await getAutoRefreshFor(site.slug);

  return (
    /* ⭐⭐ THE PAGE KEEPS ITS WIDTH AND SCROLLS SIDEWAYS, 2026-09-23. Fifth page
       of the narrow-window pass, after Housekeeping (#572), the hub (#576),
       Dropdown Config (#577) and View All Lists (#578). The user was shown this
       one wrapping and chose to floor it rather than leave it.
       🛑 WHY THE SCROLLER IS HERE AND NOT ON `<main>`: the dashboard layout
       gives `<main>` **`overflow-x-clip`**, which cuts overflow off WITHOUT
       creating a scroll container. Deliberate and shared by every dashboard
       page (a scroll container there would re-anchor `position: sticky`).
       📊 WHY THE FLOOR IS 875px, AND WHY ALL THREE TABLE PAGES SHARE IT.
       2026-09-24: "the table width squishes too much, make the smallest width
       wider." **The floor is now set by HOW MUCH TABLE STAYS VISIBLE**, not by
       the page chrome, and 827 of table is the number because **that is
       Housekeeping's table card**, a width the user had already approved. 827 +
       the 48px of `p-6` = 875, the same floor Housekeeping carries. All three
       table pages were raised to it together so the tab has ONE table minimum.
       The scrollbar appears at about a 1178px window.
       📌 WHAT 827 BUYS HERE, measured: Name 400, +Status 510, **+Author 670**,
       +Automation Tags 910. So 827 clears Author and reaches well into
       Automation Tags. It was 840 before, so this page moved the least.
       📌 THE HEADER'S OWN MINIMUM IS STILL A LOWER BOUND, so keep it: the header
       is `flex flex-wrap items-start justify-between gap-4` and wraps when
       **content < title + 16 + toolbar**. The toolbar is a constant 531px on
       every website (auto-refresh, Refresh List, Export CSV, divider, Edit
       mode); the TITLE varies:
         Zapier 131 -> needs 678 | n8n 151 -> 698 | Make 157 -> 704 |
         GHL 208 -> 755 | **GHL B2B 238 -> 785**
       **875 clears the worst of those by 42px.** If the floor is ever cut, 833
       is the hard bottom or GHL B2B wraps.
       ⚠️⚠️ ONE ROUTE, FIVE WEBSITES: MEASURE ALL OF THEM. Make alone gives 704,
       which would have left GHL B2B wrapping by 81px, and Make is the one you
       naturally open first. **I quoted the user ~1040 off Make before measuring
       the rest; the real answer was ~1128.**
       📌 THE TITLE IS THE SITE'S `label` + `description` FROM `sites.ts`, which
       16 surfaces share. If either is ever reworded, re-measure this floor. */
    <div className="overflow-x-auto">
      <div className="min-w-[875px] space-y-6 p-6">
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
    </div>
  );
}
