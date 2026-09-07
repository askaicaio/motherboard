// =============================================================
// Automations BETA2 - a second ASSEMBLY bench, seeded from Alpha2
// =============================================================
// Created 2026-09-07: "Create a beta2 page with this as the basis", where
// "this" was /automations-alpha2.
//
// ⚠️⚠️ WHAT THIS FILE IS: a VERBATIM COPY of /automations-alpha2 as it stood
// on 2026-09-07, with only its name and badge changed. **Every difference from
// Alpha2 from here on is therefore deliberate**, which is the whole point of
// seeding a bench this way: the diff against Alpha2 is the record of what the
// user actually changed.
//
// ⚠️⚠️ IT IS A SEPARATE FILE AND MUST STAY ONE. Every version in
// AUTOMATIONS_VERSIONS is self-contained on its own route so the live hub can
// never be broken by bench work. **Do not factor shared pieces out of these
// pages into common components**, however much duplication that leaves. See
// the first Beta for how this plays out in practice.
//
// ⚠️⚠️ WHICH CONTROLS ARE REAL, AND IT IS NO LONGER ALL-OR-NOTHING (2026-09-07):
//   REAL: the health cluster in the page header, the "Auto-API health check"
//     toggle plus the "API Health Check" button. Copied from the live hub and
//     fully working, inside a HealthCheckProvider and a TooltipProvider.
//   STATIC: the three Tools at the foot of the Sources table are still
//     decorative <span>s and do nothing.
// **So do not say "the controls on this page are static" any more, and do not
// say they all work either. Check the one you mean.** The page shipped
// all-static from Alpha2 (#480) and gained the health cluster the same week.
//
// The DATA is real, same as Alpha2: the same queries as the live page plus
// three read-only ones of its own, so the layout can be judged on true numbers.
//
// Alpha2's own design rationale follows, and still applies verbatim because the
// layout is unchanged:
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
import {
  ApiHealthCheckButton,
  AutoHealthCheckToggle,
  HealthCheckProvider,
} from "@/components/automations/api-health-check";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
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

/** How many rows the error feed shows before it stops. */
const FEED_ROWS = 9;

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsBeta2Page() {
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

  // ⚠️ THE 30-DAY TREND QUERY WAS HERE (error counts per platform per UTC
  // day). It existed only to fill the hero panel's stacked columns, and went
  // with the hero on 2026-09-07. **Nothing on this page charts errors over time
  // any more.** If a chart comes back, this query and the `dayKeys` / `byDay`
  // derivations below it are what to restore.

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

  // ⚠️ EVERYTHING THE HERO DERIVED WAS HERE and went with it on 2026-09-07:
  // the chart's x-axis (`dayKeys`), its per-day buckets (`byDay`,
  // `dayTotals`, `maxDayTotal`, `windowTotal`), the estate totals
  // (`portfolio`), the all-time error sum (`totalErrors`) and the
  // `connected` count. `statsByPlatform` and `errorCounts` STAY, because the
  // Sources table reads both per website.

  return (
    <div className="space-y-5 p-6">
      {/* ⚠️ THE PROVIDERS ARE REQUIRED BY THE HEALTH CLUSTER BELOW, not
          decoration. `HealthCheckProvider` is what lets the "API Health Check"
          button fan a live check out; `TooltipProvider` is needed because the
          toggle's label carries a tooltip, and the shared `TOOLTIP_DELAY_MS`
          keeps its timing identical to the rest of the tab. Both were added
          2026-09-07 with the cluster. */}
      <TooltipProvider delay={TOOLTIP_DELAY_MS}>
        <HealthCheckProvider>
          {/* ---- Page header. The dark hero panel that used to sit under it is
              gone (2026-09-07), so this row is now the whole top of the
              page. ---- */}
          {/* 🛑🛑 `items-start`, NOT THE `items-end` THIS PAGE INHERITED FROM
          ALPHA2. Changed 2026-09-07 with the health cluster, and it is a FIX
          APPLIED IN ADVANCE rather than a preference: **the first Beta shipped
          this exact bug and the user reported it** ("These elements are
          misplaced", 2026-09-03).
          WHY IT ONLY BREAKS ONCE THE CONTROLS ARE REAL: Alpha2's right-hand
          side was a SINGLE-LINE static text pair, so bottom-aligning it looked
          fine. The real cluster is TWO lines (the toggle row, then "Next check
          in ..."), and `items-end` aligns its BOTTOM with the SUBTITLE's
          bottom, dropping the whole cluster down the page. Do not restore
          `items-end` here or on any version that gains these controls. */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-semibold tracking-tight">
                  Automations
                </h1>
                {/* ⚠️ The badge is what tells you which version you are looking
                at, and it is the ONLY visible difference from Alpha2 right now.
                Keep it in step with this page's label in AUTOMATIONS_VERSIONS
                (src/components/layout/sidebar.tsx); the menu and the badge are
                separate strings and nothing links them. */}
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Beta2
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Tracks workflows from different automation websites all in one
                place.
              </p>
            </div>
            {/* ⭐⭐ THE REAL HEALTH CLUSTER, 2026-09-07: "Check S2 for reference.
            Add these back into Beta2", where S2 was the live hub's header.
            The "Auto-API health check" toggle (24h timer, stored results) plus
            the manual "API Health Check" button, which fans the per-website
            live check out to every site at once. Same order as the live hub,
            [auto toggle] [manual action].
            ⚠️⚠️ THIS IS THE FIRST WORKING CONTROL ON BETA2. The page was
            seeded from Alpha2 (#480) where EVERY control was a decorative
            `<span>`; these two are real. **The three Tools at the foot of the
            Sources table are STILL decorative**, so "the controls are static"
            is no longer true of this page as a whole. Check before you claim
            either way.
            ⚠️ WHAT IT REPLACED: a static text pair reading "5 websites, 4
            connected / health check in 23h". The right half is now live in the
            toggle itself, which counts down properly. **The left half, the
            estate-wide "N websites, N connected" count, is GONE and is
            nowhere else on this page** - it went with `connected`. That was
            raised before merging.
            ⚠️ These are SHARED client components (`src/components/automations/`),
            imported by the live hub and both benches. That is fine and is not
            the thing the version-independence rule protects: the rule is about
            not factoring the PAGE files into shared pieces. */}
            <div className="flex items-center gap-3">
              <AutoHealthCheckToggle
                initialEnabled={health.enabled}
                initialNextCheckAt={health.nextCheckAt}
              />
              <ApiHealthCheckButton />
            </div>
          </div>

          {/* ⚠️⚠️ THE DARK HERO PANEL WAS HERE and was removed on 2026-09-07:
          "S1 Remove this feature." It was the whole reason Alpha2 looked
          different from the other versions: a black status board holding the
          911-automations count, the running/paused/errors sentence, a STATIC
          "Run health check" stand-in, a STATIC "N of 5 API keys live" pill,
          and a 30-day error chart stacked by website.
          ⚠️ WHAT WENT WITH IT, so nobody hunts for a regression: the
          estate-wide totals (`portfolio`, `totalErrors`), the whole 30-day
          trend query and its `dayKeys` / `byDay` / `dayTotals` /
          `maxDayTotal` / `windowTotal` derivations, `TREND_DAYS`, and the
          `connected` count. **None of those numbers appear anywhere on this
          page any more.** The Sources table still carries per-website
          totals, errors and last-error, which is what survived.
          ⭐ AND WHAT REPLACED ITS TWO STATIC CONTROLS: the REAL health
          cluster now in the page header, copied from the live hub. See the
          note up there. */}

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
                      <th className="px-3 py-2.5 font-semibold">
                        Active / Paused
                      </th>
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
                      const refreshOn =
                        autoRefreshMap[site.slug]?.enabled ?? false;

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
                            <StatusPill
                              tone={status.tone}
                              label={status.label}
                            />
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
                                  refreshOn
                                    ? "text-emerald-600"
                                    : "text-zinc-400",
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
                  <p className="text-sm text-zinc-500">
                    No errors captured yet.
                  </p>
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

          {/* ⚠️ This said "Alpha2 preview. Controls on this page are static" until
          2026-09-07. BOTH halves were wrong after that date: the page is Beta2,
          and its health controls are real. Only the Sources table's three Tools
          are still decorative. */}
          <p className="pt-1 text-center text-xs text-zinc-400">
            Beta2 bench. The Tools row below the Sources table is still static;
            the live hub is at{" "}
            <Link href="/automations" className="underline hover:text-zinc-600">
              Automations
            </Link>
            .
          </p>
        </HealthCheckProvider>
      </TooltipProvider>
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

function Tool({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
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

// ⚠️ `untilLabel()` LIVED HERE. It formatted the header's static "health
// check in 23h" text, which the real `AutoHealthCheckToggle` replaced on
// 2026-09-07 with its own live countdown. Nothing else called it.
