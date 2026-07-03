// Per Website Error History page. One per automation website (5 total),
// reached from the "Error History" button on each Main Page card. One dynamic
// route serves all five websites; the slug is validated against
// AUTOMATION_SITES (unknown slug -> 404).
//
// The page shows a header + the 3-column error log table (Name · Link · Error
// Date), chronological with the latest errors on top.
//
// PLACEHOLDER: error tracking doesn't exist yet (no runs / errors are stored),
// so the table renders empty (no `rows` passed) and shows its empty state. The
// real error events land once error capture is built.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { getAutomationSite } from "@/lib/automations/sites";
import { ErrorHistoryTable } from "@/components/automations/error-history-table";

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
        <h1 className="text-2xl font-semibold tracking-tight">
          {site.label} Error History
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Error history for {site.label} automations.
        </p>
      </div>

      {/* Error log table (3 columns: Name · Link · Error Date), chronological
          with the latest errors on top. PLACEHOLDER: error tracking isn't built
          yet, so no rows are passed and the table shows its empty state. Feed
          the per-error-event list into `rows` once error capture lands. */}
      <ErrorHistoryTable />
    </div>
  );
}
