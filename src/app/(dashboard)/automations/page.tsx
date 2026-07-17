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
import { buttonVariants } from "@/components/ui/button";
import { Workflow, X, HelpCircle } from "lucide-react";
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
import {
  getErrorCountsByPlatform,
  getDaysSinceLastErrorByPlatform,
} from "@/lib/automations/errors";

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

  // Total captured errors per platform, for each card's "# Errors" stat. Only
  // Make writes error rows today, so the other cards read 0 until their capture
  // lands (getErrorCountsByPlatform omits platforms with no errors).
  const errorCounts = await getErrorCountsByPlatform();

  // Whole days since each platform's most recent captured error, for the "Days
  // since last Error" stat (computed in SQL). A platform with NO captured errors
  // is absent here, so its card keeps the red-X placeholder ("not tracked yet");
  // otherwise we show the day count. Only Make has errors today.
  const daysSinceErrorByPlatform = await getDaysSinceLastErrorByPlatform();

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
            {/* Encircled "?" that opens the Automations Feature Integration
                page. Black by default, lighter on hover. */}
            <Link
              href="/automations/feature-integration"
              aria-label="Automations Feature Integration"
              className="text-zinc-900 transition-colors hover:text-zinc-400"
            >
              <HelpCircle className="h-5 w-5" />
            </Link>
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

      {/* Toolbar strip: a long, thin, SHARP-EDGED (non-rounded) card above the
          website cards, holding global Automations actions. Currently the
          "View All Lists" button → the combined Everything Table
          (/automations/all). No label; sharp corners deliberately set it apart
          from the rounded website cards below. */}
      <div className="flex items-center bg-card px-4 py-2.5 ring-1 ring-foreground/10">
        <Link
          href="/automations/all"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          View All Lists
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {AUTOMATION_SITES.map((site) => {
          const stats = statsByPlatform.get(site.slug) ?? {
            total: 0,
            active: 0,
            paused: 0,
          };
          // Days since this platform's most recent captured error. undefined
          // when the error table is empty for it (keep the red-X placeholder).
          const daysSinceError = daysSinceErrorByPlatform[site.slug];
          return (
            <Card
              key={site.slug}
              className="h-full transition-shadow hover:shadow-md"
            >
              <CardContent className="flex h-full flex-col gap-3 p-5">
                {/* Header: website title + description on the left, "Open"
                    button on the right. Row is bottom-aligned so "Open" sits
                    inline with the description line. */}
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {/* Per-card website logo. Monochrome SVG glyphs are tinted
                          to the brand colour via a CSS mask; full-colour icons
                          (the GHL favicon) render as a plain image. */}
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
                    <p className="mt-1 text-sm text-zinc-600">
                      {site.description}
                    </p>
                  </div>
                  {/* View List: opens this website's per-website page.
                      Bottom-right, inline with the description line. */}
                  <Link
                    href={`/automations/${site.slug}`}
                    className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
                  >
                    View List
                  </Link>
                </div>

                {/* Top-of-card status stats (left) + Error History button
                    (right). Stats: auto-refresh state, then "Days since last
                    Error", both above the Total/Active/Paused row. */}
                <div className="flex items-end justify-between gap-3 border-t pt-3">
                  <div className="flex flex-col gap-2">
                    {/* Auto-refresh on/off state (green check / red X). Reads
                        the same stored state the per-website toggle writes;
                        display-only here. */}
                    <AutoRefreshStat
                      enabled={autoRefreshMap[site.slug]?.enabled ?? false}
                    />
                    {/* Days since last Error. When this platform has captured
                        errors, show days since the most recent one (number always
                        RED, label default colour). When the error table is empty
                        for it, keep the red-X placeholder ("not tracked yet").
                        Only Make has errors today; the rest show the X. */}
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span>Days since last Error:</span>
                      {daysSinceError !== undefined ? (
                        <span>
                          <span className="text-red-600">{daysSinceError}</span>{" "}
                          days
                        </span>
                      ) : (
                        <X
                          className="h-3.5 w-3.5 text-red-600"
                          aria-label="not tracked yet"
                        />
                      )}
                    </div>
                  </div>
                  {/* Error History: opens this website's own error history page. */}
                  <Link
                    href={`/automations/${site.slug}/errors`}
                    className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
                  >
                    Error History
                  </Link>
                </div>

                <div className="grid grid-cols-4 gap-2 border-t pt-3">
                  <Stat label="Total" value={stats.total} />
                  <Stat
                    label="Active"
                    value={stats.active}
                    valueClassName="text-green-600"
                  />
                  <Stat label="Paused" value={stats.paused} />
                  {/* Errors count: total captured errors for this platform
                      (automation_errors rows). Always red. Reads real data for
                      Make; the other platforms show 0 until their capture lands. */}
                  <Stat
                    label="Errors"
                    value={errorCounts[site.slug] ?? 0}
                    valueClassName="text-red-600"
                  />
                </div>

                {/* Status button row. With "Open" moved to the top-right, the
                    API status button (flex-1) now fills the full card width. */}
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
