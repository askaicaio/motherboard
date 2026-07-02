// Per Website Error History page. One per automation website (5 total),
// reached from the "Error History" button on each Main Page card. One dynamic
// route serves all five websites; the slug is validated against
// AUTOMATION_SITES (unknown slug -> 404).
//
// FIRST SLICE: this is a shell. Error tracking doesn't exist yet (no runs /
// errors are stored), so the page shows a header + an empty-state placeholder.
// The real error log / timeline lands once error events are captured.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { getAutomationSite } from "@/lib/automations/sites";

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

      {/* Placeholder empty state. Error tracking isn't built yet, so there's
          nothing to show. Replace with the real error log / timeline once
          error events are captured. */}
      <div className="rounded-lg border border-dashed border-zinc-200 p-10 text-center">
        <p className="text-sm text-zinc-500">
          No error history yet. Error tracking for this website has not been set
          up.
        </p>
      </div>
    </div>
  );
}
