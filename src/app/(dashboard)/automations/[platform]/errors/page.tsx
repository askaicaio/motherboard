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
       📊 WHY THE FLOOR IS 800px, AND WHY IT DIFFERS FROM THE SIBLING'S 840.
       Same wrapping rule (content < title + 16 + toolbar) but different
       numbers: this toolbar is 447px on every website (auto-refresh, Check for
       New Errors, Edit mode) against the sibling's 531, while the titles run
       LONGER here because they carry "Error History":
         n8n 228 -> needs 691 | GHL 233 -> 696 | Make 246 -> 709 |
         Zapier 256 -> 719 | **GHL B2B 283 -> 746**
       746 + the 48px of `p-6` = 794, rounded to 800. The scrollbar appears at
       about a 1088px window. **The two pages are not the same width on purpose.**
       ⚠️ ONE ROUTE, FIVE WEBSITES: GHL B2B is the worst case on both pages, and
       it is 37px worse than Make here. Measure every site, not the first one.
       📌 THE TITLE IS BUILT FROM THE SITE'S `label` IN `sites.ts`, shared by 16
       surfaces. Reword it and this floor needs re-measuring. */
    <div className="overflow-x-auto">
      <div className="min-w-[800px] space-y-6 p-6">
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
