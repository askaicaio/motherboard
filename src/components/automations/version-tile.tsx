// One tile in a list of Automations design versions.
// =============================================================
// ⚠️ EXTRACTED FROM `automations/feature-integration/page.tsx` ON 2026-09-28,
// when the Archived Versions page was added and needed to render the same
// thing. **It is unchanged from the copy that lived there**; only its address
// moved.
//
// 📌 WHY THIS EXTRACTION IS ALLOWED when the version PAGES must never share
// their layout: those pages are benches, and keeping them apart is what stops
// an experiment breaking the live hub. This is a leaf in
// `src/components/automations/`, which the registry's own note calls out as
// fine to import. **The rule is about page layout, not about every component.**
//
// ⭐ AND SHARING IT IS THE POINT: a tile on the archive page that drifted from
// a tile on the Feature Integration page would make the same version look like
// two different things depending on which list you found it in.
// =============================================================

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { AutomationVersion } from "@/lib/automations/versions";

export function VersionTile({ version }: { version: AutomationVersion }) {
  return (
    <Link
      href={version.href}
      target="_blank"
      rel="noreferrer"
      prefetch={false}
      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50"
    >
      <version.icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-900">
            {version.label}
          </span>
          {/* The new-tab tell. Muted until hover so a grid of them does not
              read as a grid of warnings. */}
          <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500">
          {version.blurb}
        </span>
      </span>
    </Link>
  );
}
