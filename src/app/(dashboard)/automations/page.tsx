// Automations Main Page, the hub. One card per automation website; each
// card shows a Total / Active / Paused stats row (counts from the
// automations table) and an "Open →" link to that website's page. The
// table / search / edit-mode features live on those per-website pages.

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { CopyApiKeyButton } from "@/components/automations/copy-api-key-button";
import { AutoRefreshStat } from "@/components/automations/auto-refresh-stat";
import {
  ApiHealthCheckButton,
  AutoHealthCheckToggle,
  HealthCheckProvider,
} from "@/components/automations/api-health-check";
import { getHealthState } from "@/lib/automations/health";
import { getAutoRefreshMap } from "@/lib/automations/autorefresh";

export const dynamic = "force-dynamic";

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsPage() {
  await requireAuth();

  // Last stored Auto-API health check results (per platform) + the toggle's
  // state, so the cards seed their status from the last scheduled check.
  const health = await getHealthState();

  // Per-platform auto-refresh state (enabled + nextRefreshAt), so each card can
  // show its "Auto-refresh list:" stat with a live countdown. Same stored
  // app-setting the per-website toggle writes; the card is display-only.
  const autoRefreshMap = await getAutoRefreshMap();

  // Count automations per platform & status in one grouped query, then fold
  // into per-platform totals for the cards.
  const grouped = await db
    .select({
      platform: automations.platform,
      status: automations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(automations)
    .groupBy(automations.platform, automations.status);

  const statsByPlatform = new Map<string, PlatformStats>();
  for (const site of AUTOMATION_SITES) {
    statsByPlatform.set(site.slug, { total: 0, active: 0, paused: 0 });
  }

  for (const row of grouped) {
    const s = statsByPlatform.get(row.platform);
    if (!s) continue; // ignore any platform not in the known set
    s.total += row.count;
    if (row.status === "active") s.active += row.count;
    else if (row.status === "paused") s.paused += row.count;
  }

  return (
    <div className="space-y-6 p-6">
      <HealthCheckProvider>
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
        {/* Top-right toolbar, mirroring the per-website order
            [auto toggle] [manual action]: the "Auto-API health check" toggle
            (24h timer, stored results) + the manual "API Health Check" button
            (fans the per-card live check out to all 5 cards at once). */}
        <div className="flex items-center gap-3">
          <AutoHealthCheckToggle
            initialEnabled={health.enabled}
            initialNextCheckAt={health.nextCheckAt}
          />
          <ApiHealthCheckButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {AUTOMATION_SITES.map((site) => {
          const stats = statsByPlatform.get(site.slug) ?? {
            total: 0,
            active: 0,
            paused: 0,
          };
          return (
            <Card
              key={site.slug}
              className="h-full transition-shadow hover:shadow-md"
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  {/* Per-card website logo. Monochrome SVG glyphs are tinted to
                      the brand colour via a CSS mask; full-colour icons (the GHL
                      favicon) render as a plain image in their own colours. */}
                  {site.iconColor ? (
                    <span
                      aria-hidden
                      className="h-8 w-8 shrink-0"
                      style={{
                        backgroundColor: site.iconColor,
                        maskImage: `url(${site.icon})`,
                        WebkitMaskImage: `url(${site.icon})`,
                        maskRepeat: "no-repeat",
                        WebkitMaskRepeat: "no-repeat",
                        maskPosition: "center",
                        WebkitMaskPosition: "center",
                        maskSize: "contain",
                        WebkitMaskSize: "contain",
                      }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={site.icon}
                      alt=""
                      className="h-8 w-8 shrink-0 object-contain"
                    />
                  )}
                  <h3 className="text-xl font-medium">{site.label}</h3>
                </div>
                {/* Description sits directly under the website name. */}
                <p className="text-sm text-zinc-600">{site.description}</p>

                {/* Top-of-card status stats: auto-refresh state, then "Days
                    since last Error", both above the Total/Active/Paused row. */}
                <div className="flex flex-col gap-2 border-t pt-3">
                  {/* Auto-refresh state (label + live countdown / off X). Reads
                      the same stored state the per-website toggle writes;
                      display-only here. */}
                  <AutoRefreshStat
                    enabled={autoRefreshMap[site.slug]?.enabled ?? false}
                    nextRefreshAt={autoRefreshMap[site.slug]?.nextRefreshAt ?? null}
                  />
                  {/* Days since last Error. PLACEHOLDER: stuck at 0 for now —
                      error tracking doesn't exist yet, so nothing feeds this.
                      The count number is always red; the label is default
                      color. Wire the real value in once error tracking lands. */}
                  <p className="text-sm font-medium">
                    Days since last Error: <span className="text-red-600">0</span> days
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t pt-3">
                  <Stat label="Total" value={stats.total} />
                  <Stat
                    label="Active"
                    value={stats.active}
                    valueClassName="text-green-600"
                  />
                  <Stat label="Paused" value={stats.paused} />
                </div>

                <div className="mt-auto flex items-center gap-2 border-t pt-3">
                  {/* Clickable status button. Seeds from the server-side
                      presence check (green "API Key Integrated" / red "No API
                      Integration"); clicking runs a live verify and re-colors
                      based on whether the key actually works right now. Only the
                      boolean reaches the client; the secret never does. (Make is
                      wired; the rest stay red until their syncs land.) */}
                  <CopyApiKeyButton
                    platform={site.slug}
                    hasApiKey={platformHasApiKey(site.slug)}
                    initialOk={health.results[site.slug]?.ok}
                  />
                  <Link
                    href={`/automations/${site.slug}`}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Open →
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </HealthCheckProvider>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className={cn("text-lg font-semibold tabular-nums", valueClassName)}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}
