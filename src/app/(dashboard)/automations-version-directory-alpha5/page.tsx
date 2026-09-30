// =============================================================
// Version Directory "Alpha5", route /automations-version-directory-alpha5
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE VERSION DIRECTORY: **search first**. One of six
// created together on 2026-09-30.
//
// 📌 WHAT IT ANSWERS. Twenty-eight versions across five destinations, and
// **the only way to find one today is to remember which card it is in**. Once
// a list is past about twenty items the job stops being "browse" and becomes
// "find", and the blurbs are the only place a design's actual idea is written
// down, so they are worth searching too.
//
// ⭐ IT IS THE SAME ARGUMENT DROPDOWN CONFIG ALPHA6 MADE about seven choice
// tables: one box across everything, because the thing you are looking for is
// rarely in the tab you are on.
//
// ⚠️ THE ARCHIVE IS INCLUDED AND IS WHY SEARCH EARNS ITS PLACE. Seventeen of
// the twenty-eight are archived, so a search that skipped them would miss
// most of what exists; the status chips let you put them back out of the way.
//
// ⚠️ IT IS A BENCH. The live page's cards are untouched.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, Search } from "lucide-react";
import { VersionDirectoryAlpha5Client } from "./search-client";

export const dynamic = "force-dynamic";

export default async function VersionDirectoryAlpha5Page() {
  await requireAuth();

  return (
    <div className="@container space-y-6 p-6">
      <Link
        href="/automations/feature-integration"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Feature Integration
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Search className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Design Versions
          </h1>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Alpha5
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          One box across every version, name and description, with chips for the
          experiment and the state.
        </p>
      </div>

      <VersionDirectoryAlpha5Client />
    </div>
  );
}
