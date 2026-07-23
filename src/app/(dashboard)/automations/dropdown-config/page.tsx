// Automations Dropdown Configuration page. Reached from the "Dropdown
// Configuration" button in the Main Page toolbar strip.
//
// This is a LITERAL route segment (`dropdown-config`), so it takes precedence
// over the sibling `[platform]` dynamic route for this exact path (same pattern
// as `feature-integration` and `all`).
//
// PLACEHOLDER: this is a stub shell so the toolbar button resolves without a
// 404. The real content (a page-level edit-mode toggle + one choice table per
// dropdown-driven column: Author, Automation Tags, GHL Tags, Trigger Event,
// Webhook Links) is tracked as its own to-do items and is not built yet.

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AutomationsDropdownConfigPage() {
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
          Dropdown Configuration
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage the choices for the dropdown-driven table columns.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
        Configuration tables are coming soon.
      </div>
    </div>
  );
}
