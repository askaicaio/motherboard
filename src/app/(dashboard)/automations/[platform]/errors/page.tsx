// Per Website Error History page. One per automation website (5 total),
// reached from the "Error History" button on each Main Page card. One dynamic
// route serves all five websites; the slug is validated against
// AUTOMATION_SITES (unknown slug -> 404).
//
// Shows a header + the 3-column error log table (Name · Error Date · Error
// Message), newest first, read from the captured `automation_errors` for this
// platform. Error capture runs in the background (see the checker cron); this
// page only reads + displays. The list controls (Refresh List / auto-refresh)
// deliberately live on the Per Website Page, not here — they'd be redundant.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { getAutomationSite } from "@/lib/automations/sites";
import { ErrorHistoryTable } from "@/components/automations/error-history-table";
import { getErrorHistoryRows } from "@/lib/automations/errors";

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
        <div className="flex items-center gap-2">
          {/* Website brand logo to the LEFT of the title, same treatment as the
              Per Website Page header + the Main Page card: a monochrome SVG
              glyph tinted to the brand colour via CSS mask when iconColor is
              set, otherwise a plain full-colour image. */}
          {site.iconColor ? (
            <span
              aria-hidden
              className="h-8 w-8 shrink-0"
              style={{
                backgroundColor: site.iconColor,
                maskImage: `url(${site.icon})`,
                WebkitMaskImage: `url(${site.icon})`,
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
                maskSize: "contain",
                WebkitMaskSize: "contain",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.icon}
              alt=""
              className="h-8 w-8 shrink-0 object-contain"
            />
          )}
          <h1 className="text-2xl font-semibold tracking-tight">
            {site.label} Error History
          </h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Error history for {site.label} automations.
        </p>
      </div>

      {/* Error log table (Name · Error Date · Error Message), newest first,
          read from the captured automation_errors for this platform. */}
      <ErrorHistoryTable rows={errorRows} />
    </div>
  );
}
