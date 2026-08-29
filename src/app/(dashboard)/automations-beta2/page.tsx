// =============================================================
// Automations ALPHA2 - a second redesign proposal for the hub
// =============================================================
// The third presentation of the same information, alongside the live hub
// (/automations) and the first proposal (/automations-beta). Nothing here
// writes, and every control is a static visual.
//
// Alpha 1 and the live page both answer the SAME question, "what do I have",
// with 5 cards. This one deliberately answers different questions and uses a
// different shape to do it:
//
//   - "what has been happening": a dark hero panel leading with a 30-day
//     stacked error chart across all 5 websites, so the estate is read as a
//     trend line first and an inventory second.
//   - "what broke, and when": a live cross-platform error feed down the right
//     side, newest first. The live page and Alpha 1 can both tell you 614
//     errors exist; neither can tell you what the last one WAS.
//   - "how do the websites compare": one dense TABLE instead of 5 cards.
//     Cards force you to compare numbers that sit in different places on
//     screen; a table puts them in a column, which is what comparison wants.
//
// The DATA is real (same queries as the live page, plus three read-only ones
// of its own) so the layout can be judged on true numbers.
// =============================================================

import Link from "next/link";
import {
  Activity,
  ChevronRight,
  Inbox,
  List,
  ListChecks,
  Plug,
  RefreshCw,
} from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";

import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automationErrors, automations } from "@/lib/db/schema";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { getHealthState } from "@/lib/automations/health";
import { getAutoRefreshMap } from "@/lib/automations/autorefresh";
import {
  getErrorCountsByPlatform,
  getDaysSinceLastErrorByPlatform,
} from "@/lib/automations/errors";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Per-website accent colour, same values Alpha 1 uses. Local to the page so
// sites.ts stays as it is (its `iconColor` only covers the monochrome-mask
// sites, and every site needs a colour here for the chart and the table).
const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

/** Width of the hero chart, in days. */
const TREND_DAYS = 30;
/** How many rows the error feed shows before it stops. */
const FEED_ROWS = 9;

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsAlpha2Page() {
  await requireAuth();

  const health = await getHealthState();
  const autoRefreshMap = await getAutoRefreshMap();
  const errorCounts = await getErrorCountsByPlatform();
  const daysSinceErrorByPlatform = await getDaysSinceLastErrorByPlatform();

  const grouped = await db
    .select({
      platform: automations.platform,
      status: automations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(automations)
    .groupBy(automations.platform, automations.status);

  // Error counts per (platform, UTC day) across the chart window. Feeds the
  // stacked columns in the hero.
  const dayExpr = sql`to_char(${automationErrors.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const trendRows = await db
    .select({
      platform: automationErrors.platform,
      day: sql<string>`${dayExpr}`,
      count: sql<number>`count(*)::int`,
    })
    .from(automationErrors)
    .where(
      sql`${automationErrors.occurredAt} >= now() - make_interval(days => ${TREND_DAYS - 1})`,
    )
    .groupBy(automationErrors.platform, dayExpr);

  // The error feed: newest errors across EVERY website in one list. The Error
  // History pages are per-website, so this cross-platform view is new.
  const feed = await db
    .select({
      id: automationErrors.id,
      platform: automationErrors.platform,
      message: automationErrors.message,
      occurredAt: automationErrors.occurredAt,
      name: automations.name,
    })
    .from(automationErrors)
    .innerJoin(automations, eq(automationErrors.automationId, automations.id))
    .orderBy(desc(automationErrors.occurredAt))
    .limit(FEED_ROWS);

  const statsByPlatform = new Map<string, PlatformStats>();
  for (const site of AUTOMATION_SITES) {
    statsByPlatform.set(site.slug, { total: 0, active: 0, paused: 0 });
  }
  for (const row of grouped) {
    const s = statsByPlatform.get(row.platform);
    if (!s) continue;
    s.total += row.count;
    if (row.status === "active") s.active += row.count;
    else if (row.status === "paused") s.paused += row.count;
  }

  // The window's day keys, oldest first, so the columns share an x-axis.
  const now = new Date();
  const dayKeys: string[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const byDay: Record<string, Record<string, number>> = {};
  for (const row of trendRows) {
    (byDay[row.day] ??= {})[row.platform] = row.count;
  }
  const dayTotals = dayKeys.map((k) =>
    AUTOMATION_SITES.reduce(
      (sum, site) => sum + (byDay[k]?.[site.slug] ?? 0),
      0,
    ),
  );
  const maxDayTotal = Math.max(...dayTotals, 0);
  const windowTotal = dayTotals.reduce((a, b) => a + b, 0);

  const portfolio = { total: 0, active: 0, paused: 0 };
  for (const site of AUTOMATION_SITES) {
    const s = statsByPlatform.get(site.slug);
    if (!s) continue;
    portfolio.total += s.total;
    portfolio.active += s.active;
    portfolio.paused += s.paused;
  }
  const totalErrors = AUTOMATION_SITES.reduce(
    (sum, site) => sum + (errorCounts[site.slug] ?? 0),
    0,
  );
  const connected = AUTOMATION_SITES.filter((s) =>
    platformHasApiKey(s.slug),
  ).length;

  return (
    <div className="space-y-5 p-6">
      {/* ---- Page header. Deliberately bare: on this layout the numbers live
              in the hero panel directly below, not up here. ---- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Automations
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha2
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Tracks workflows from different automation websites all in one
            place.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>
            {AUTOMATION_SITES.length} websites, {connected} connected
          </span>
          <span className="text-zinc-300">/</span>
          <span>
            {health.enabled
              ? `health check in ${untilLabel(health.nextCheckAt)}`
              : "health check off"}
          </span>
        </div>
      </div>

      {/* ---- Hero panel. Dark on purpose: it separates the "state of the
              estate" from the working surfaces below it, the way a status
              board sits apart from the tools. Left = the count. Right = the
              same estate over 30 days, stacked by website. ---- */}
      <div className="overflow-hidden rounded-2xl bg-zinc-950 text-white">
        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:p-7">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-5xl font-semibold leading-none tabular-nums">
                  {portfolio.total}
                </span>
                <span className="text-sm text-zinc-400">
                  automations tracked
                </span>
              </div>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
                Across {AUTOMATION_SITES.length} websites.{" "}
                <span className="font-medium text-emerald-400">
                  {portfolio.active} running
                </span>
                ,{" "}
                <span className="font-medium text-zinc-200">
                  {portfolio.paused} paused
                </span>
                , and{" "}
                <span className="font-medium text-red-400">
                  {totalErrors} errors
                </span>{" "}
                captured all time.
              </p>
            </div>

            {/* Static stand-in for the health-check control. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-white">
                <Activity className="h-3.5 w-3.5" />
                Run health check
              </span>
              <span className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs text-zinc-400 ring-1 ring-white/15">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    health.enabled ? "bg-emerald-400" : "bg-zinc-500",
                  )}
                />
                {connected} of {AUTOMATION_SITES.length} API keys live
              </span>
            </div>
          </div>

          {/* Stacked error chart. One column per day, each split by website in
              its own colour, so a spike shows WHERE it came from and not just
              that it happened. */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Errors, last {TREND_DAYS} days
                </div>
                <div className="mt-1 font-heading text-2xl font-semibold leading-none tabular-nums">
                  {windowTotal}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                {AUTOMATION_SITES.map((site) => (
                  <span
                    key={site.slug}
                    className="flex items-center gap-1.5 text-[11px] text-zinc-400"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: ACCENT[site.slug] }}
                    />
                    {site.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex h-32 items-end gap-[3px]">
              {dayKeys.map((day, i) => {
                const total = dayTotals[i];
                const heightPct =
                  maxDayTotal > 0 && total > 0
                    ? Math.max(4, (total / maxDayTotal) * 100)
                    : 0;
                return (
                  <div
                    key={day}
                    title={`${day}: ${total}`}
                    className="flex h-full flex-1 flex-col justify-end"
                  >
                    {total > 0 ? (
                      <div
                        className="flex w-full flex-col-reverse overflow-hidden rounded-[2px]"
                        style={{ height: `${heightPct}%` }}
                      >
                        {AUTOMATION_SITES.map((site) => {
                          const v = byDay[day]?.[site.slug] ?? 0;
                          if (!v) return null;
                          return (
                            <span
                              key={site.slug}
                              style={{
                                height: `${(v / total) * 100}%`,
                                backgroundColor: ACCENT[site.slug],
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-[2px] w-full rounded-[1px] bg-white/10" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
              <span>{dayKeys[0]}</span>
              <span>{dayKeys[dayKeys.length - 1]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Working surfaces: the comparison table, then the feed. ---- */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* One row per website. A table because comparing 5 websites means
            comparing the same figure 5 times, and a column does that in a way
            5 separate cards cannot. */}
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="font-heading text-sm font-semibold text-zinc-900">
              Sources
            </h2>
            <span className="text-xs text-zinc-500">
              {AUTOMATION_SITES.length} websites
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-2.5 font-semibold">Website</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Total
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Active / Paused</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Errors
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Last error</th>
                  <th className="px-4 py-2.5 font-semibold">Refresh</th>
                </tr>
              </thead>
              <tbody>
                {AUTOMATION_SITES.map((site) => {
                  const stats = statsByPlatform.get(site.slug) ?? {
                    total: 0,
                    active: 0,
                    paused: 0,
                  };
                  const accent = ACCENT[site.slug];
                  const hasKey = platformHasApiKey(site.slug);
                  const days = daysSinceErrorByPlatform[site.slug];
                  const errors = errorCounts[site.slug] ?? 0;
                  const activePct = stats.total
                    ? (stats.active / stats.total) * 100
                    : 0;
                  const pausedPct = stats.total
                    ? (stats.paused / stats.total) * 100
                    : 0;
                  const refreshOn = autoRefreshMap[site.slug]?.enabled ?? false;

                  const status: { tone: Tone; label: string } = !hasKey
                    ? { tone: "off", label: "Not connected" }
                    : days !== undefined && days <= 1
                      ? { tone: "bad", label: "Erroring" }
                      : days !== undefined && days <= 7
                        ? { tone: "warn", label: "Recent errors" }
                        : { tone: "ok", label: "Healthy" };

                  return (
                    <tr
                      key={site.slug}
                      className="border-b last:border-0 transition-colors hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className="h-8 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: accent }}
                          />
                          {site.iconColor ? (
                            <span
                              aria-hidden
                              className="h-5 w-5 shrink-0"
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
                              className="h-5 w-5 shrink-0 object-contain"
                            />
                          )}
                          <span className="font-medium text-zinc-900">
                            {site.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill tone={status.tone} label={status.label} />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-zinc-900">
                        {stats.total}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                            <span
                              style={{
                                width: `${activePct}%`,
                                backgroundColor: accent,
                              }}
                            />
                            <span
                              className="bg-zinc-300"
                              style={{ width: `${pausedPct}%` }}
                            />
                          </div>
                          <span className="whitespace-nowrap text-xs tabular-nums text-zinc-600">
                            {stats.active} / {stats.paused}
                          </span>
                        </div>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right font-semibold tabular-nums",
                          errors > 0 ? "text-red-600" : "text-zinc-400",
                        )}
                      >
                        {errors}
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-600">
                        {days !== undefined ? (
                          `${days}d ago`
                        ) : (
                          <span className="text-zinc-400">not tracked</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                          <RefreshCw
                            className={cn(
                              "h-3 w-3 shrink-0",
                              refreshOn ? "text-emerald-600" : "text-zinc-400",
                            )}
                          />
                          {refreshOn ? "On" : "Off"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* The 3 global tools, as a footer strip under the table rather than
              the standalone grey bar the live page floats above the cards. */}
          <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-4 py-3">
            <Tool icon={Plug} label="Feature Integration" />
            <Tool icon={List} label="View All Lists" />
            <Tool icon={ListChecks} label="Dropdown Configuration" />
          </div>
        </div>

        {/* Cross-platform error feed. Every other surface counts errors; this
            is the only one that says what they WERE. */}
        <div className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="font-heading text-sm font-semibold text-zinc-900">
              Latest errors
            </h2>
            <span className="text-xs text-zinc-500">all websites</span>
          </div>

          {feed.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <Inbox className="h-5 w-5 text-zinc-300" />
              <p className="text-sm text-zinc-500">No errors captured yet.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {feed.map((row) => {
                const site = AUTOMATION_SITES.find(
                  (s) => s.slug === row.platform,
                );
                return (
                  <li
                    key={row.id}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-50"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: ACCENT[row.platform] ?? "#a1a1aa",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900">
                          {row.name}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                          {agoLabel(new Date(row.occurredAt))}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {row.message ?? "No message recorded"}
                      </p>
                      <span className="mt-1 inline-block text-[10px] uppercase tracking-wider text-zinc-400">
                        {site?.label ?? row.platform}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-auto border-t bg-muted/40 px-4 py-2.5 text-center text-xs font-medium text-zinc-600">
            View all error history
          </div>
        </div>
      </div>

      <p className="pt-1 text-center text-xs text-zinc-400">
        Alpha2 preview. Controls on this page are static, the live hub is at{" "}
        <Link href="/automations" className="underline hover:text-zinc-600">
          Automations
        </Link>
        .
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

type Tone = "ok" | "warn" | "bad" | "off";

const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warn: "bg-amber-50 text-amber-800 ring-amber-600/25",
  bad: "bg-red-50 text-red-700 ring-red-600/20",
  off: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

const TONE_DOTS: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  off: "bg-zinc-400",
};

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        TONE_CLASSES[tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOTS[tone])} />
      {label}
    </span>
  );
}

function Tool({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-foreground/10">
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      {label}
      <ChevronRight className="h-3 w-3 shrink-0 text-zinc-400" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Time labels. Coarse on purpose: these are glanceable states, not timestamps,
// and the exact values still live on the per-website pages.
// ---------------------------------------------------------------------------

function agoLabel(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function untilLabel(iso: string | null): string {
  if (!iso) return "soon";
  const mins = Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return "any moment";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
