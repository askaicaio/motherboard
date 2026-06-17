// =============================================================
// Cron: the auto-refresh checker for the Automations tab
// =============================================================
// Runs frequently (see vercel.json). On each tick it reads the per-platform
// auto-refresh state and, for any platform that is ENABLED and whose
// nextRefreshAt has passed, runs that platform's sync, then pushes the next
// refresh out by 24h. This is the engine behind the per-website "Auto-refresh
// mode" toggle (Option A): the toggle only sets a flag + a due time; this
// cron is what actually performs the scheduled refresh.
//
// Refresh precision = this cron's interval (a refresh fires at the first tick
// at/after its due time, so up to one interval "late").
//
// Auth: Vercel passes Authorization: Bearer <CRON_SECRET>; reject others.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAutoRefreshMap, bumpNextRefresh } from "@/lib/automations/autorefresh";
import { isSyncablePlatform } from "@/lib/automations/sites";
import { syncMakeAutomations } from "@/lib/integrations/make-sync";
import { syncN8nAutomations } from "@/lib/integrations/n8n-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // No secret configured = allow in dev only.
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

/** Run the sync for a platform. Returns null for platforms without a sync. */
async function runSync(platform: string) {
  switch (platform) {
    case "make":
      return syncMakeAutomations();
    case "n8n":
      return syncN8nAutomations();
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const map = await getAutoRefreshMap();
  const now = Date.now();
  const results: Array<Record<string, unknown>> = [];

  for (const [platform, state] of Object.entries(map)) {
    if (!state?.enabled || !state.nextRefreshAt) continue;
    if (!isSyncablePlatform(platform)) continue;
    if (new Date(state.nextRefreshAt).getTime() > now) continue; // not due yet

    try {
      const result = await runSync(platform);
      await bumpNextRefresh(platform); // schedule the next day
      results.push({ platform, ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[auto-refresh] ${platform} failed:`, message);
      // Bump anyway so a persistent failure doesn't hammer the API every tick;
      // the manual "Refresh List" button is always available as a fallback.
      await bumpNextRefresh(platform);
      results.push({ platform, ok: false, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: Object.keys(map).length,
    ran: results.length,
    results,
  });
}
