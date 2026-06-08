// Per Website Page — lists the automations tracked from one source website.
// Reached from the Automations Main Page cards ("Open →"). One dynamic route
// serves all five websites; the slug is validated against AUTOMATION_SITES
// (unknown slug → 404). The server fetches this platform's rows and hands
// them to the client table (search + display). Edit-mode toggle, "+ New
// Workflow", and Add/Edit Workflow dialogs land in the next PR.

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Workflow } from "lucide-react";
import { getAutomationSite } from "@/lib/automations/sites";
import { AutomationsTableClient } from "@/components/automations/automations-table-client";

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

  const rows = await db
    .select({
      id: automations.id,
      name: automations.name,
      externalUrl: automations.externalUrl,
    })
    .from(automations)
    .where(eq(automations.platform, site.slug))
    .orderBy(asc(automations.name));

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/automations"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Automations
      </Link>

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

      <AutomationsTableClient initialRows={rows} />
    </div>
  );
}
