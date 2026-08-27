// =============================================================
// Automations BETA - a redesign proposal for the Automations hub
// =============================================================
// A parallel, throwaway copy of the Automations Main Page used to try a
// different PRESENTATION of the same information. The live hub at
// /automations is untouched; nothing here writes, and every control is a
// static visual (no toggles, no health check, no navigation side effects).
//
// What this layout changes vs. the live hub:
//   1. A portfolio band on top. The live page makes you add 5 cards up in
//      your head to learn how big the estate is; here the totals lead, with
//      a stacked "mix" bar showing which website owns which share.
//   2. One attention line. Instead of hunting 5 cards for a red X, the
//      problems (no API key, fresh errors, auto-refresh off) are collected
//      into a single row at the top.
//   3. Health-first cards. Each website gets ONE status pill instead of two
//      label rows of green checks and red Xs, an Active/Paused proportion
//      bar instead of two bare numbers, and a 14-day error sparkline so a
//      lifetime error total also shows its trend.
//   4. The 3 global tools move out of the grey strip and into the 6th grid
//      cell, which the 5 website cards always left ragged.
//
// The DATA is real (same queries as the live page) so the layout can be
// judged on true numbers.
// =============================================================

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  List,
  ListChecks,
  Plug,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { sql } from "drizzle-orm";

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

// ---------------------------------------------------------------------------
// Per-website accent colour. Local to the beta page so sites.ts stays as it
// is. `iconColor` there only exists for the sites whose glyph is a monochrome
// mask, but the redesign tints a logo tile + a mix-bar segment for EVERY site,
// so all 5 need one. The two GHL subaccounts share the brand green at
// different weights: same family (they are the same product), still separable
// in the stacked bar.
// ---------------------------------------------------------------------------
const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

const TREND_DAYS = 14;

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsBetaPage() {
  await requireAuth();

  const health = await getHealthState();
  const autoRefreshMap = await getAutoRefreshMap();
  const errorCounts = await getErrorCountsByPlatform();
  const daysSinceErrorByPlatform = await getDaysSinceLastErrorByPlatform();

  // Same grouped count the live page runs: one row per (platform, status).
  const grouped = await db
    .select({
      platform: automations.platform,
      status: automations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(automations)
    .groupBy(automations.platform, automations.status);

  // Newest run time per website, for each card's "Last run" line. New to this
  // layout: the live page shows nothing about recency of activity.
  const lastRunRows = await db
    .select({
      platform: automations.platform,
      lastRunAt: sql<Date | null>`max(${automations.lastRunAt})`,
    })
    .from(automations)
    .groupBy(automations.platform);

  // Error counts per (platform, UTC day) over the trend window, for the
  // sparklines. Platforms with no capture simply come back empty and draw a
  // flat baseline.
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

  const lastRunByPlatform: Record<string, Date | null> = {};
  for (const row of lastRunRows) {
    lastRunByPlatform[row.platform] = row.lastRunAt
      ? new Date(row.lastRunAt)
      : null;
  }

  // The window's day keys, oldest first, so every sparkline shares an x-axis.
  const now = new Date();
  const dayKeys: string[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const trendByPlatform: Record<string, Record<string, number>> = {};
  for (const row of trendRows) {
    (trendByPlatform[row.platform] ??= {})[row.day] = row.count;
  }

  // Portfolio roll-up for the band on top.
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

  // The attention line. Three separate problems, each collapsed to one chip
  // per website so the row stays a single line in the common case.
  const attention: { label: string; tone: "bad" | "warn" }[] = [];
  for (const site of AUTOMATION_SITES) {
    if (!platformHasApiKey(site.slug)) {
      attention.push({
        label: `${site.label}: no API integration`,
        tone: "bad",
      });
    }
    const days = daysSinceErrorByPlatform[site.slug];
    if (days !== undefined && days <= 1) {
      attention.push({
        label: `${site.label}: errored ${days === 0 ? "today" : "yesterday"}`,
        tone: "bad",
      });
    }
    if (!autoRefreshMap[site.slug]?.enabled) {
      attention.push({ label: `${site.label}: auto-refresh off`, tone: "warn" });
    }
  }

  return (
    <div className="space-y-5 p-6">
      {/* ---- Page header. Same title and subtitle as the live hub, with the
              health-check cluster reduced to one read-only status chip. ---- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-zinc-500" />
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Automations
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Beta
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Tracks workflows from different automation websites all in one
            place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-foreground/10">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-60",
                  health.enabled ? "animate-ping bg-emerald-400" : "bg-zinc-300",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  health.enabled ? "bg-emerald-500" : "bg-zinc-400",
                )}
              />
            </span>
            {health.enabled
              ? `Health check in ${untilLabel(health.nextCheckAt)}`
              : "Health check off"}
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-zinc-700">
            <Activity className="h-4 w-4" />
            Run check
          </span>
        </div>
      </div>

      {/* ---- Portfolio band. The estate's size and shape before any single
              website is read: five figures, then the mix bar. ---- */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        {/* Dividers only at lg, where all 5 figures share ONE row. Below that
            the grid wraps, and `divide-x` (a DOM-order rule, not a per-row
            one) would hang a stray border off the first cell of row 2. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-zinc-100">
          <Kpi label="Automations tracked" value={portfolio.total} />
          <Kpi
            label="Active"
            value={portfolio.active}
            valueClassName="text-emerald-600"
          />
          <Kpi label="Paused" value={portfolio.paused} />
          <Kpi
            label="Errors captured"
            value={totalErrors}
            valueClassName="text-red-600"
          />
          <Kpi
            label="Sources connected"
            value={`${connected}/${AUTOMATION_SITES.length}`}
          />
        </div>

        <div className="border-t px-5 py-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
            {AUTOMATION_SITES.map((site) => {
              const s = statsByPlatform.get(site.slug);
              const pct =
                portfolio.total && s ? (s.total / portfolio.total) * 100 : 0;
              return (
                <span
                  key={site.slug}
                  title={`${site.label}: ${s?.total ?? 0}`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: ACCENT[site.slug],
                  }}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            {AUTOMATION_SITES.map((site) => (
              <span
                key={site.slug}
                className="flex items-center gap-1.5 text-xs text-zinc-600"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ACCENT[site.slug] }}
                />
                {site.label}
                <span className="font-semibold tabular-nums text-zinc-900">
                  {statsByPlatform.get(site.slug)?.total ?? 0}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Attention line. Every problem across all 5 websites on one row,
              or a single green line when there is nothing to chase. ---- */}
      {attention.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-50/70 px-4 py-3 ring-1 ring-amber-500/20">
          <span className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {attention.length} thing{attention.length === 1 ? "" : "s"} need
            {attention.length === 1 ? "s" : ""} attention
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {attention.map((item) => (
              <span
                key={item.label}
                className={cn(
                  "rounded-full bg-white px-2.5 py-1 text-xs font-medium ring-1",
                  item.tone === "bad"
                    ? "text-red-700 ring-red-600/20"
                    : "text-amber-800 ring-amber-600/25",
                )}
              >
                {item.label}
              </span>
            ))}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50/70 px-4 py-3 text-sm font-medium text-emerald-900 ring-1 ring-emerald-500/20">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          All sources connected, refreshing, and error-free.
        </div>
      )}

      {/* ---- Website cards + the tools cell. ---- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          const trend = trendByPlatform[site.slug] ?? {};
          const activePct = stats.total
            ? (stats.active / stats.total) * 100
            : 0;
          const pausedPct = stats.total
            ? (stats.paused / stats.total) * 100
            : 0;

          // One pill replaces the live page's two rows of check/X marks.
          // Priority: a missing key beats error freshness, since nothing else
          // on the card can be trusted without it.
          const status: { tone: Tone; label: string } = !hasKey
            ? { tone: "off", label: "Not connected" }
            : days !== undefined && days <= 1
              ? { tone: "bad", label: "Erroring" }
              : days !== undefined && days <= 7
                ? { tone: "warn", label: "Recent errors" }
                : { tone: "ok", label: "Healthy" };

          return (
            <div
              key={site.slug}
              className="group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
            >
              {/* Brand edge: the fastest way to tell the cards apart, and it
                  carries the same colour as this website's mix-bar segment. */}
              <div
                className="h-[3px] w-full shrink-0"
                style={{ backgroundColor: accent }}
              />

              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${accent}1F` }}
                    >
                      {site.iconColor ? (
                        <span
                          className="h-6 w-6"
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
                          className="h-6 w-6 object-contain"
                        />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-heading text-base font-semibold text-zinc-900">
                        {site.label}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {site.description}
                      </p>
                    </div>
                  </div>
                  <StatusPill tone={status.tone} label={status.label} />
                </div>

                {/* Total leads, with the Active/Paused split shown as a
                    proportion instead of two more bare numbers. */}
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-heading text-3xl font-semibold leading-none tabular-nums text-zinc-900">
                        {stats.total}
                      </span>
                      <span className="text-xs text-zinc-500">automations</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-600">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: accent }}
                        />
                        <span className="font-semibold tabular-nums text-zinc-900">
                          {stats.active}
                        </span>
                        active
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-zinc-300" />
                        <span className="font-semibold tabular-nums text-zinc-900">
                          {stats.paused}
                        </span>
                        paused
                      </span>
                    </div>
                  </div>
                  <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
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
                </div>

                {/* Errors, with the last 14 days beside the lifetime total so
                    a big number that stopped growing reads differently from a
                    big number that is still growing. */}
                <div className="mt-auto rounded-lg bg-zinc-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "text-lg font-semibold leading-none tabular-nums",
                          errors > 0 ? "text-red-600" : "text-zinc-400",
                        )}
                      >
                        {errors}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {errors === 1 ? "error" : "errors"} captured
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      {days !== undefined
                        ? `last ${days}d ago`
                        : "not tracked yet"}
                    </span>
                  </div>
                  <Sparkline dayKeys={dayKeys} counts={trend} />
                </div>
              </div>

              {/* Footer: the two per-website destinations, plus the state
                  lines that used to take a full labelled row each. */}
              <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <RefreshCw
                      className={cn(
                        "h-3 w-3 shrink-0",
                        autoRefreshMap[site.slug]?.enabled
                          ? "text-emerald-600"
                          : "text-zinc-400",
                      )}
                    />
                    {autoRefreshMap[site.slug]?.enabled
                      ? "Auto-refresh on"
                      : "Auto-refresh off"}
                  </span>
                  <span className="truncate">
                    Last run {agoLabel(lastRunByPlatform[site.slug] ?? null)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500">
                    Errors
                  </span>
                  <span className="flex items-center gap-0.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-800 ring-1 ring-foreground/10">
                    View list
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* The 6th cell. Five websites in a 3-wide grid always leave a hole,
            so the grey toolbar strip moves into it and the row closes. */}
        <div className="flex flex-col rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Tools
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Tool
              icon={Plug}
              label="Feature Integration"
              hint="What each website can and cannot do"
            />
            <Tool
              icon={List}
              label="View All Lists"
              hint="Every automation in one table"
            />
            <Tool
              icon={ListChecks}
              label="Dropdown Configuration"
              hint="Manage the dropdown column choices"
            />
          </div>
        </div>
      </div>

      <p className="pt-1 text-center text-xs text-zinc-400">
        Beta preview. Controls on this page are static, the live hub is at{" "}
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
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
        TONE_CLASSES[tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOTS[tone])} />
      {label}
    </span>
  );
}

function Kpi({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number | string;
  valueClassName?: string;
}) {
  return (
    <div className="px-5 py-4">
      <div
        className={cn(
          "font-heading text-2xl font-semibold leading-none tabular-nums text-zinc-900",
          valueClassName,
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}

/** 14 day-columns, tallest day = full height. All-zero draws a flat baseline
 *  rather than nothing, so an untracked website still reads as "no data" and
 *  not as a broken widget. */
function Sparkline({
  dayKeys,
  counts,
}: {
  dayKeys: string[];
  counts: Record<string, number>;
}) {
  const values = dayKeys.map((k) => counts[k] ?? 0);
  const max = Math.max(...values, 0);
  return (
    <div className="mt-2.5">
      <div className="flex h-7 items-end gap-[3px]">
        {values.map((v, i) => (
          <span
            key={dayKeys[i]}
            title={`${dayKeys[i]}: ${v}`}
            className={cn(
              "flex-1 rounded-[2px]",
              v > 0 ? "bg-red-400" : "bg-zinc-200",
            )}
            style={{
              height:
                max > 0 && v > 0
                  ? `${Math.max(12, (v / max) * 100)}%`
                  : "3px",
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
        Last {dayKeys.length} days
      </div>
    </div>
  );
}

function Tool({
  icon: Icon,
  label,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  hint: string;
}) {
  return (
    <span className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 ring-1 ring-foreground/10">
      <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-800">{label}</span>
        <span className="block truncate text-[11px] text-zinc-500">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Time labels. Coarse on purpose: these are glanceable states, not timestamps,
// and the exact values still live on the per-website pages.
// ---------------------------------------------------------------------------

function agoLabel(date: Date | null): string {
  if (!date) return "never";
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
