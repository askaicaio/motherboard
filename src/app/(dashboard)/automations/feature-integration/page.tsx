// Automations Feature Integration page. Reached from the encircled "?" icon
// next to the "Automations" title on the Main Page. Documents which Motherboard
// app features each website's API integration unlocks.
//
// This is a LITERAL route segment (`feature-integration`), so it takes
// precedence over the sibling `[platform]` dynamic route for this exact path.
//
// Content is intentionally empty for now (the user will fill it in later); this
// is just the page shell: auth + back link + title + subtext.

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AutomationsFeatureIntegrationPage() {
  await requireAuth();

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
          Automations Feature Integration
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Motherboard app features enabled by website API integrations.
        </p>
      </div>

      {/* Content to come (user will fill this in later). */}
    </div>
  );
}
