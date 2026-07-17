// "Everything Table" — every automation across all 5 websites in one combined,
// read-only table. Reached from the Main Page "View All Lists" toolbar button.
//
// LITERAL route segment (`all`), so it takes precedence over the sibling
// `[platform]` dynamic route for this exact path.
//
// The heavy lifting (search / sort / display) is in AllAutomationsTableClient,
// which mirrors the Per Website Page table minus the per-platform toolbar and
// edit/delete, plus a Website column. This server shell just loads every
// platform's rows + their latest error date.

import Link from "next/link";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";
import { getLastErrorAtAllAutomations } from "@/lib/automations/errors";
import { AllAutomationsTableClient } from "@/components/automations/all-automations-table-client";

export const dynamic = "force-dynamic";

export default async function AllAutomationsPage() {
  await requireAuth();

  // Every automation, all platforms, name-ascending (the client re-sorts).
  const baseRows = await db
    .select({
      id: automations.id,
      name: automations.name,
      externalUrl: automations.externalUrl,
      status: automations.status,
      purpose: automations.purpose,
      lastRunAt: automations.lastRunAt,
      lastEditedAt: automations.lastEditedAt,
      platform: automations.platform,
    })
    .from(automations)
    .orderBy(asc(automations.name));

  // Latest captured error per automation (across all platforms) → Last Error.
  const lastErrorByAutomation = await getLastErrorAtAllAutomations();
  const rows = baseRows.map((r) => ({
    ...r,
    lastErrorAt: lastErrorByAutomation.get(r.id) ?? null,
  }));

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
        <h1 className="text-2xl font-semibold tracking-tight">All Automations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every automation from all connected websites in one table.
        </p>
      </div>

      <AllAutomationsTableClient rows={rows} />
    </div>
  );
}
