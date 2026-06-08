// Automations Main Page — the hub. One card per automation website; each
// card's "Open →" link leads to that website's Per Website Page
// (/automations/<slug>). The table / search / edit-mode features live on
// those per-website pages, not here. Card layout mirrors the Campaigns tab.

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { Card, CardContent } from "@/components/ui/card";
import { Workflow } from "lucide-react";
import { AUTOMATION_SITES } from "@/lib/automations/sites";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  await requireAuth();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Tracks workflows from different automation websites all in one place.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {AUTOMATION_SITES.map((site) => (
          <Card
            key={site.slug}
            className="h-full transition-shadow hover:shadow-md"
          >
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-zinc-500" />
                <h3 className="font-medium">{site.label}</h3>
              </div>
              <p className="text-sm text-zinc-600">{site.description}</p>
              <div className="mt-auto flex items-center border-t pt-3">
                <Link
                  href={`/automations/${site.slug}`}
                  className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Open →
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
