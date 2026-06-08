// Per Website Page — shell. Reached from the Automations Main Page cards
// ("Open →"). One dynamic route serves all five websites; the slug is
// validated against AUTOMATION_SITES (unknown slug → 404). Header only for
// now — the automations table, search bar, "Back" button, edit-mode toggle,
// and Add/Edit Workflow popups land in the Per-Website-Page work next.

import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guard";
import { Workflow } from "lucide-react";
import { getAutomationSite } from "@/lib/automations/sites";

export const dynamic = "force-dynamic";

export default async function AutomationWebsitePage({
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {site.label}
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{site.description}</p>
        </div>
      </div>
    </div>
  );
}
