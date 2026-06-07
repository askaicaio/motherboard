// Automations list page — walking skeleton. Header only for now; the
// table + "Add automation" dialog + data wiring land in later phases.

import { requireAuth } from "@/lib/auth/guard";
import { Workflow } from "lucide-react";

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
    </div>
  );
}
