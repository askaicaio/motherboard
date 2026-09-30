// =============================================================
// Version Directory "Alpha3", route /automations-version-directory-alpha3
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE VERSION DIRECTORY: **an experiment rail beside the
// list**. One of six created together on 2026-09-30.
//
// 📌 WHAT IT ANSWERS. The directory grows by CARD. One card per experiment
// meant one card when there was one experiment, and it is five now (four
// families plus the archive page), stacked down a page that also has a
// capability table on it. **A rail does not grow downward**: a sixth
// experiment is a sixth row in a 240px column, not another 200px of page.
//
// ⭐ IT IS THE PATTERN THAT ALREADY WON ONCE HERE. Dropdown Configuration ran
// seven tabs on one line until 2026-09-25, when the rail from its Alpha1 bench
// shipped for exactly this reason: navigation stops setting the layout's size.
//
// ⚠️ THE ARCHIVE IS JUST ANOTHER RAIL ROW. Its seventeen pages stop being a
// separate destination, which is the other half of what makes the directory
// feel bigger than it is.
//
// ⚠️ IT IS A BENCH. The live page's cards are untouched.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, FolderTree } from "lucide-react";
import { VersionDirectoryAlpha3Client } from "./experiment-rail-client";

export const dynamic = "force-dynamic";

export default async function VersionDirectoryAlpha3Page() {
  await requireAuth();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px] space-y-6 p-6">
        <Link
          href="/automations/feature-integration"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feature Integration
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FolderTree className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Design Versions
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha3
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            A rail of experiments beside one list. Another experiment costs a
            row, not another card.
          </p>
        </div>

        <VersionDirectoryAlpha3Client />
      </div>
    </div>
  );
}
