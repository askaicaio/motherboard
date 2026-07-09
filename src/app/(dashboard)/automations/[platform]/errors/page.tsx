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
    <div className="space-y-6 p-6">
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
  );
}
