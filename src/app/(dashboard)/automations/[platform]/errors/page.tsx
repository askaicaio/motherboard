// Per Website Error History page. One per automation website (5 total),
// reached from the "Error History" button on each Main Page card. One dynamic
// route serves all five websites; the slug is validated against
// AUTOMATION_SITES (unknown slug -> 404).
//
// Server shell: auth + slug check + load this platform's captured errors, then
// hand off to ErrorHistoryTableClient (header with the "Check for New Errors"
// button + Edit-mode delete toggle, and the error-log table). Error capture
// itself runs in the background (see the checker cron). The LIST controls
// (Refresh List / auto-refresh) live on the Per Website Page, not here.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import {
  getAutomationSite,
  isErrorCapturePlatform,
} from "@/lib/automations/sites";
import { ErrorHistoryTableClient } from "@/components/automations/error-history-table-client";
import { getErrorHistoryRows } from "@/lib/automations/errors";
import { getAutoRefreshFor } from "@/lib/automations/autorefresh";
import { platformHasApiKey } from "@/lib/automations/credentials";

export const dynamic = "force-dynamic";

export default async function AutomationErrorHistoryPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  await requireAuth();
  const { platform } = await params;

  const site = getAutomationSite(platform);
  if (!site) notFound();

  // Captured error events for this platform (newest first). Empty until the
  // background error capture has run. Feeds the error-log table.
  const errorRows = await getErrorHistoryRows(site.slug);

  // Same shared per-platform auto-refresh state the Per Website Page toggle
  // uses. The header's "Auto-refresh list" toggle reads/writes this; since error
  // capture is coupled to the toggle, it's the switch for error capture too.
  const autoRefresh = await getAutoRefreshFor(site.slug);

  return (
    /* ⭐⭐ THE PAGE KEEPS ITS WIDTH AND SCROLLS SIDEWAYS, 2026-09-23. Sixth and
       last page of the narrow-window pass, done together with its sibling
       `[platform]/page.tsx` because they share the same wrapping header.
       🛑 WHY THE SCROLLER IS HERE AND NOT ON `<main>`: `<main>` is
       `overflow-x-clip`, which cuts overflow off WITHOUT creating a scroll
       container, and changing that would re-anchor `position: sticky` on every
       dashboard page. Each page gets its own scroller.
       📊 WHY THE FLOOR IS 875px, AND WHY ALL THREE TABLE PAGES SHARE IT.
       2026-09-24: "the table width squishes too much, make the smallest width
       wider." **The floor is now set by HOW MUCH TABLE STAYS VISIBLE**, not by
       the page chrome, and 827 of table is the number because **that is
       Housekeeping's table card**, a width the user had already approved. 827 +
       the 48px of `p-6` = 875, the same floor Housekeeping carries. All three
       table pages were raised to it together so the tab has ONE table minimum.
       The scrollbar appears at about a 1178px window.
       ⚠️⚠️ THIS PAGE'S TABLE IS THE ODD ONE, AND NOT IN THE WAY IT LOOKS.
       It carries its own **`w-full min-w-[1000px]`**, so it NEVER compresses:
       Name 400, Error Date 101, Error Message 475, Actions 24. **The message
       column is 475px at every floor** - I first wrote that 875 would widen it
       from 227 to 302 by subtracting from the card, and that was wrong, because
       the table's own minimum holds the columns and the CARD scrolls instead.
       ⭐ SO WHAT THE FLOOR BUYS HERE IS VISIBLE CARD, NOT COLUMN WIDTH: 752 ->
       827 of the 1000px table, i.e. 75px more of it before you scroll sideways
       inside the card.
       🛑 THE INNER SCROLLBAR THEREFORE SURVIVES on this page. Removing it needs
       the card to reach the table's full 1000, which is a 1048 floor and a
       scrollbar at about a 1336px window. ⚠️ **THAT WAS NOT PUT TO THE USER** -
       they chose 827 as a SHARED number for the three table pages, before I had
       measured that this one table has a 1000px minimum of its own. So the
       surviving inner scrollbar is a known consequence, not an agreed one; if it
       bothers them, 1048 is the number.
       📌 THE HEADER'S OWN MINIMUM IS STILL A LOWER BOUND, so keep it: same
       wrapping rule as the sibling, but this toolbar is 447px (auto-refresh,
       Check for New Errors, Edit mode) against its 531, while the titles run
       LONGER because they carry "Error History":
         n8n 228 -> needs 691 | GHL 233 -> 696 | Make 246 -> 709 |
         Zapier 256 -> 719 | **GHL B2B 283 -> 746**
       **875 clears the worst by 81px.** If the floor is ever cut, 794 is the
       hard bottom. ⭐ The two sibling pages used to differ on purpose (840 vs
       800); they are the same now for a different and better reason - one table
       minimum across the tab.
       ⚠️ ONE ROUTE, FIVE WEBSITES: GHL B2B is the worst case on both pages, and
       it is 37px worse than Make here. Measure every site, not the first one.
       📌 THE TITLE IS BUILT FROM THE SITE'S `label` IN `sites.ts`, shared by 16
       surfaces. Reword it and this floor needs re-measuring. */
    <div className="overflow-x-auto">
      <div className="min-w-[875px] space-y-6 p-6">
        <Link
          href="/automations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Automations
        </Link>

        <ErrorHistoryTableClient
          site={{
            slug: site.slug,
            label: site.label,
            icon: site.icon,
            iconColor: site.iconColor,
          }}
          canCapture={isErrorCapturePlatform(site.slug)}
          hasApiKey={platformHasApiKey(site.slug)}
          autoRefresh={autoRefresh}
          initialRows={errorRows}
        />
      </div>
    </div>
  );
}
