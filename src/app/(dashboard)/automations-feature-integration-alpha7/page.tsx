// =============================================================
// Feature Integration "Alpha7", route /automations-feature-integration-alpha7
// =============================================================
// ⭐ A LAYOUT BENCH FOR THE FEATURE INTEGRATION PAGE: **a website rail beside
// a detail panel**. One of eight created together on 2026-09-29.
//
// 📌 WHAT IT ANSWERS. The same pattern the Dropdown Configuration page ran as
// a bench on 2026-09-25 and then SHIPPED LIVE: a left rail of subjects, one
// detail panel. **It wins here for the same reason it won there** - the
// navigation stops setting the page width, and the panel has room to say more
// about one thing than a grid cell can say about forty.
//
// ⭐ IT IS ALSO THE ONLY ONE OF THE EIGHT THAT LINKS OUT. Once a website is
// the subject of the page rather than a column heading, "open that website's
// page" is the obvious next click, and the live page offers it nowhere.
//
// ⚠️ IT ADDS NO NEW PROSE, deliberately, unlike Alpha4. A reason line under
// each gap would fit beautifully in this panel, and that copy is drafted on
// Alpha4 - **but drafting the same unreviewed sentences in two files is how
// two versions of them end up shipping.** If both patterns are wanted, they
// combine after the copy has been read.
//
// ⚠️ THE MARKS READ THE SAME STORED STATE. Nothing writes.
// =============================================================

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { ArrowLeft, PanelLeft } from "lucide-react";
import { getFeatureIntegrationMap } from "@/lib/automations/feature-integration";
import { Card, CardContent } from "@/components/ui/card";
import { VersionTile } from "@/components/automations/version-tile";
import { AUTOMATION_FEATURE_INTEGRATION_VERSIONS } from "@/lib/automations/versions";
import { FeatureIntegrationAlpha7Client } from "./website-detail-client";

export const dynamic = "force-dynamic";

const SELF = "/automations-feature-integration-alpha7";

export default async function FeatureIntegrationAlpha7Page() {
  await requireAuth();
  const state = await getFeatureIntegrationMap();

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
          <div className="flex items-center gap-2">
            <PanelLeft className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Automations Feature Integration
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha7
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            A rail of websites beside one detail panel, the pattern that shipped
            on the Dropdown Configuration page.
          </p>
        </div>

        <FeatureIntegrationAlpha7Client state={state} />

        <OtherLayouts />
      </div>
    </div>
  );
}

function OtherLayouts() {
  const others = AUTOMATION_FEATURE_INTEGRATION_VERSIONS.filter(
    (v) => v.href !== SELF,
  );
  if (others.length === 0) return null;
  return (
    <Card>
      <CardContent className="@container p-0">
        <div className="flex items-center justify-between gap-3 border-b bg-zinc-50 px-3 py-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            The other layouts
          </h2>
          <span className="text-xs text-zinc-500">
            {others.length} pages, each opens in a new tab
          </span>
        </div>
        <div className="grid gap-2 p-3 @min-[304px]:grid-cols-2 @min-[674px]:grid-cols-3">
          {others.map((version) => (
            <VersionTile key={version.href} version={version} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
