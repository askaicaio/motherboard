// =============================================================
// Automations "Beta" bench, route /automations-beta
// =============================================================
// ⚠️⚠️ THIS PAGE WAS REPLACED WHOLESALE ON 2026-09-03. It is now ALPHA3's
// master-and-detail design, at the user's decision: "This alpha3 design is
// pretty good. Make the beta page exactly like this now."
//
// WHAT IT REPLACED: the card-grid design that had just been promoted to the
// live hub, assembled from six Alpha picks over 2026-08-29 to 08-31 (logo tile,
// text treatment, counts block, error panel with its 30-day sparkline, footer
// strip, View list in the header). **All of that still ships on /automations**,
// which is frozen, so nothing is lost: this file is the bench starting a fresh
// round, not a rollback. Read `automations/page.tsx` for that design's history.
//
// ⚠️ THE ONE INVARIANT OF THIS PAGE: EVERYTHING ON IT WORKS. That is what makes
// it the bench rather than a ninth preview. The Alphas are static mock-ups on
// real data; this page is judged with its controls live. So where Alpha3 renders
// a decorative <span>, this file renders the real control:
//   - "Run health check" (one static pill on Alpha3) is the REAL pair: the
//     Auto-API health check toggle + the API Health Check button, inside their
//     HealthCheckProvider and a TooltipProvider.
//   - Error History, View list, the three rail Tools and the two per-row rail
//     buttons are all real <Link>s.
//   - the API status button is the real CopyApiKeyButton, which runs a LIVE
//     verify on click.
//
// ⚠️ WHAT THIS PAGE HAS THAT ALPHA3 DOES NOT, all at the user's direction:
//   - the CopyApiKeyButton. Alpha3 kept the API-key FACT in a status strip and
//     dropped the CONTROL, having no working controls at all. Beta kept the
//     control; the strip itself was removed on 2026-09-03, so this button is
//     now the only place the API key is reported.
//   - two square icon buttons on every rail row (Error History, View list),
//     mirroring the detail header's pair per site.
//
// ⚠️ WHAT ALPHA3'S PREMISE IS, so a future edit does not flatten it back out:
// the live page gives all 5 websites an equal, shallow slice of the screen,
// which is a summary, and a summary is what you want when everything is fine.
// This assumes you arrive because ONE website is on your mind, so it gives that
// website the whole canvas and demotes the other four to a rail. The depth that
// buys: the site's own latest errors WITH the message text, and what was edited
// on the source website most recently, which no hub surface shows.
// (Alpha3 also folded connection / refresh / error-recency into a four-column
// status strip. That strip was removed on 2026-09-03 once three of its four
// cells duplicated something else on the page.)
//
// Selection is a real URL query (?site=<slug>), read on the SERVER, so the rail
// is plain links and needs no client JS.
//
// ⚠️ DO NOT EXTRACT SHARED COMPONENTS between this file and
// `automations/page.tsx`. The whole point of the copy is that a bench
// experiment cannot break the live hub. They are meant to diverge, and the live
// page only ever changes by a deliberate promotion when the user asks.
// =============================================================

import Link from "next/link";
// NOTE: Activity, Clock and KeyRound went with the status strip on
// 2026-09-03; it was the only place any of them was used.
// AlertTriangle is this app's established error icon (six other call sites), so
// the rail's Error History button uses it rather than introducing a second one.
import {
  AlertTriangle,
  ChevronRight,
  Inbox,
  List,
  ListChecks,
  PencilLine,
  Plug,
  RefreshCw,
} from "lucide-react";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automationErrors, automations } from "@/lib/db/schema";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { getAutoRefreshMap } from "@/lib/automations/autorefresh";
import { getHealthState } from "@/lib/automations/health";
import {
  getErrorCountsByPlatform,
  getDaysSinceLastErrorByPlatform,
} from "@/lib/automations/errors";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
import { CopyApiKeyButton } from "@/components/automations/copy-api-key-button";
import {
  ApiHealthCheckButton,
  AutoHealthCheckToggle,
  HealthCheckProvider,
} from "@/components/automations/api-health-check";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Per-website accent colour. Local to the page, same as every Alpha keeps its
// own copy: `sites.ts` only has `iconColor` for the monochrome-mask sites, and
// it is SHARED WITH THE LIVE HUB, so nothing in this experiment may touch it.
const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

/** Rows each detail panel list shows before it stops. */
const PANEL_ROWS = 6;

/** How many days of error history the error panel's bar chart covers.
 *
 *  Came back to this page on 2026-09-03 with the live hub's statistics. 30, not
 *  the 14 the Alphas use: the user widened it on 2026-08-31 ("can you make this
 *  bar graph reach up to 30 days ago instead of 14?").
 *
 *  THIS NUMBER IS THE ONLY PLACE TO CHANGE IT. It drives the SQL window, the
 *  `dayKeys` axis, and the caption under the bars (which renders
 *  `dayKeys.length`), so the three cannot fall out of step. */
const TREND_DAYS = 30;

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsBetaPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  await requireAuth();

  // Which website the detail panel shows. Read on the SERVER so the rail is
  // plain links and the page needs no client JS. An unknown or missing slug
  // falls back to the first website rather than 404ing: this is a browser, and
  // a bad query should land you somewhere, not nowhere.
  const { site: siteParam } = await searchParams;
  const requested = Array.isArray(siteParam) ? siteParam[0] : siteParam;
  const selected =
    AUTOMATION_SITES.find((s) => s.slug === requested) ?? AUTOMATION_SITES[0];

  // Last stored Auto-API health check results + the toggle's state. Needed
  // because this page's health controls are REAL, unlike Alpha3's static pill.
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

  // The selected website's newest errors, WITH the message text. The card
  // layouts have room for a count and nothing else, which is the whole reason
  // this design exists.
  const siteErrors = await db
    .select({
      id: automationErrors.id,
      message: automationErrors.message,
      occurredAt: automationErrors.occurredAt,
      name: automations.name,
    })
    .from(automationErrors)
    .innerJoin(automations, eq(automationErrors.automationId, automations.id))
    .where(eq(automationErrors.platform, selected.slug))
    .orderBy(desc(automationErrors.occurredAt))
    .limit(PANEL_ROWS);

  // Error counts per (platform, UTC day) over the trend window, for the error
  // panel's bar chart. Came back with the live hub's statistics on 2026-09-03.
  // ⚠️ Grouped by platform for ALL sites even though only the selected one is
  // drawn, because that is the shape `Sparkline` takes and it costs the same
  // single aggregate either way. Platforms with no capture come back empty and
  // draw a flat baseline, which is the correct picture: GHL, GHL b2b and Zapier
  // cannot capture errors at all.
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

  // What was edited most recently ON THE SOURCE WEBSITE (the synced
  // `last_edited_at`, NOT our own Row Update). No hub surface shows this today,
  // and it is the closest thing to "what is someone actually working on".
  const recentlyEdited = await db
    .select({
      id: automations.id,
      name: automations.name,
      status: automations.status,
      lastEditedAt: automations.lastEditedAt,
    })
    .from(automations)
    .where(
      and(
        eq(automations.platform, selected.slug),
        isNotNull(automations.lastEditedAt),
      ),
    )
    .orderBy(desc(automations.lastEditedAt))
    .limit(PANEL_ROWS);

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

  // The window's day keys, oldest first, built here rather than from the rows
  // that came back. The chart then has one fixed x-axis, and a day with no
  // errors still gets a slot instead of collapsing the chart.
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

  const portfolioTotal = AUTOMATION_SITES.reduce(
    (sum, site) => sum + (statsByPlatform.get(site.slug)?.total ?? 0),
    0,
  );
  const connected = AUTOMATION_SITES.filter((s) =>
    platformHasApiKey(s.slug),
  ).length;

  // Everything the detail panel needs about the selected website.
  const stats = statsByPlatform.get(selected.slug) ?? {
    total: 0,
    active: 0,
    paused: 0,
  };
  const accent = ACCENT[selected.slug];
  const hasKey = platformHasApiKey(selected.slug);
  const days = daysSinceErrorByPlatform[selected.slug];
  const errors = errorCounts[selected.slug] ?? 0;
  // This site's per-day error counts over the window. `{}` for a platform that
  // has captured nothing, which draws a flat baseline.
  const trend = trendByPlatform[selected.slug] ?? {};
  const refreshOn = autoRefreshMap[selected.slug]?.enabled ?? false;
  const activePct = stats.total ? (stats.active / stats.total) * 100 : 0;
  const pausedPct = stats.total ? (stats.paused / stats.total) * 100 : 0;
  const status = siteStatus(hasKey, days);

  return (
    <div className="space-y-5 p-6">
      {/* The health controls carry tooltips, so they need a provider, and the
          shared TOOLTIP_DELAY_MS keeps their timing identical to the rest of
          the tab. HealthCheckProvider is what lets the "API Health Check"
          button drive the CopyApiKeyButton below it. */}
      <TooltipProvider delay={TOOLTIP_DELAY_MS}>
        <HealthCheckProvider>
          {/* ⚠️ `items-start`, NOT Alpha3's `items-end`. This is a real bug
              inherited by copying Alpha3 wholesale, spotted by the user on
              2026-09-03 ("These elements are misplaced").
              WHY IT ONLY BREAKS HERE: Alpha3's right-hand side is a SINGLE-LINE
              static "Run health check" pill, so bottom-aligning it looked fine.
              This page has the REAL control cluster, which is TWO lines (the
              toggle row, then "Next check in ..."), and `items-end` dropped the
              whole cluster down to align its bottom with the SUBTITLE's bottom
              instead of its top with the heading. The live hub has always used
              `items-start` here; match it.
              ⚠️ The DETAIL PANEL's own header row further down is a different
              row and is correctly `items-start` already. Do not conflate them. */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-semibold tracking-tight">
                  Automations
                </h1>
                {/* Version badge, same pill the seven Alphas wear, so you can
                    tell at a glance this is not the live hub. The live page
                    deliberately has none. */}
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Beta
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Tracks workflows from different automation websites all in one
                place.
              </p>
            </div>
            {/* ⚠️ REAL CONTROLS, where Alpha3 has one static "Run health check"
                pill. Same [auto toggle] [manual action] order the per-website
                pages use. */}
            <div className="flex shrink-0 items-center gap-3">
              <AutoHealthCheckToggle
                initialEnabled={health.enabled}
                initialNextCheckAt={health.nextCheckAt}
              />
              <ApiHealthCheckButton />
            </div>
          </div>

          {/* One pane, split. The rail is the master list, the panel is the
              detail view. Both scroll inside the pane rather than the page, so
              the split never comes apart as the detail content grows. */}
          <div className="flex min-h-[640px] overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {/* ---- Rail. Every website, always visible, so switching costs one
                    click and you never lose your bearings. ---- */}
            <div className="flex w-64 shrink-0 flex-col border-r">
              <div className="border-b px-4 py-3">
                <div className="font-heading text-sm font-semibold text-zinc-900">
                  Sources
                </div>
                {/* The aggregate this layout otherwise gives up, in one line so
                    nothing is actually lost. */}
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  {portfolioTotal} automations, {connected} of{" "}
                  {AUTOMATION_SITES.length} connected
                </div>
              </div>

              <nav className="flex-1 p-2">
                {AUTOMATION_SITES.map((site) => {
                  const s = statsByPlatform.get(site.slug) ?? {
                    total: 0,
                    active: 0,
                    paused: 0,
                  };
                  const isCurrent = site.slug === selected.slug;
                  // NOTE: `siteErrorCount` was read here for the red badge on
                  // the right of each row. Both went on 2026-09-03.
                  // Same two indicators the detail header carries, per rail
                  // row. Both come from the SAME rules as the header's pill:
                  // `siteStatus()` for the dot, the stored auto-refresh setting
                  // for the icon. Added 2026-09-03 at the user's request.
                  const siteStat = siteStatus(
                    platformHasApiKey(site.slug),
                    daysSinceErrorByPlatform[site.slug],
                  );
                  const siteRefreshOn =
                    autoRefreshMap[site.slug]?.enabled ?? false;
                  return (
                    // ⚠️⚠️ THE ROW IS A <div>, NOT A <Link>, AND IT HAS TO BE.
                    // It used to be one Link wrapping everything. The two action
                    // buttons added on 2026-09-03 are themselves links, and
                    // NESTING AN <a> INSIDE AN <a> IS INVALID HTML: the browser
                    // silently un-nests it and the row's click target breaks.
                    // So the row is a plain div; the site-select Link now covers
                    // the spine, glyph and text (flex-1, so still nearly the
                    // whole row), and the buttons sit OUTSIDE it as siblings.
                    // The hover tint moved up here so hovering anywhere in the
                    // row, buttons included, still highlights it.
                    <div
                      key={site.slug}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                        isCurrent ? "bg-zinc-100" : "hover:bg-zinc-50",
                      )}
                    >
                      <Link
                        href={`/automations-beta?site=${site.slug}`}
                        className="flex min-w-0 flex-1 items-center gap-2.5"
                      >
                        {/* Accent spine, full opacity on the selected row and
                          faint on the rest, so the current website is obvious
                          without a second indicator. */}
                        <span
                          aria-hidden
                          className="h-7 w-[3px] shrink-0 rounded-full"
                          style={{
                            backgroundColor: ACCENT[site.slug],
                            opacity: isCurrent ? 1 : 0.35,
                          }}
                        />
                        <SiteGlyph site={site} className="h-5 w-5" />
                        <span className="min-w-0 flex-1">
                          {/* ⭐ THE TITLE LINE reads: Name (dot) (refresh icon).
                            The user sketched it as "(.) Make (Green Refresh
                            Icon)" on 2026-09-03 and then moved the dot the same
                            day: "Put the dot after the website title instead,
                            but before the refresh icon." So the ORDER IS
                            DELIBERATE and is not the sketch; do not restore the
                            leading dot.
                            Both indicators are LABEL-LESS here on purpose:
                            "remove the text on the colored dot so the pill only
                            has the colored dot", and the refresh was asked for
                            as an icon. The rail is only w-64, and the user has
                            since stripped it further still (the word "tracked"
                            and the red error badge both went on 2026-09-03), so
                            the direction of travel here is FEWER words, not
                            more. Do not add labels to these.
                            ⚠️ THE LOST LABELS ARE RESTORED ON HOVER via `title`,
                            or the dot's colour would be the only clue to a
                            four-state value. These sit inside the site-select
                            <Link>, which carries no `title` of its own, so they
                            win rather than being swallowed by an ancestor's.
                            ⚠️ This is a FLEX row now, so the name keeps
                            `truncate` and needs `min-w-0` to shrink; the two
                            indicators are `shrink-0` so the name yields first. */}
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "min-w-0 truncate text-sm",
                                isCurrent
                                  ? "font-semibold text-zinc-900"
                                  : "font-medium text-zinc-700",
                              )}
                            >
                              {site.label}
                            </span>
                            <span
                              aria-label={siteStat.label}
                              title={siteStat.label}
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                TONE_DOTS[siteStat.tone],
                              )}
                            />
                            <span
                              aria-label={
                                siteRefreshOn
                                  ? "Auto-refresh on"
                                  : "Auto-refresh off"
                              }
                              title={
                                siteRefreshOn
                                  ? "Auto-refresh on"
                                  : "Auto-refresh off"
                              }
                              className="shrink-0"
                            >
                              <RefreshCw
                                className={cn(
                                  "h-3 w-3",
                                  siteRefreshOn
                                    ? "text-emerald-600"
                                    : "text-zinc-400",
                                )}
                              />
                            </span>
                          </span>
                          {/* ⚠️ "tracked" WAS CUT AND THEN RESTORED, both on
                            2026-09-03: "Remove the 'Tracked' text here" then
                            "Return the 'tracked' text we removed just now". It
                            stays. */}
                          <span className="block text-[11px] tabular-nums text-zinc-500">
                            {s.total} tracked
                          </span>
                        </span>
                      </Link>

                      {/* ⭐ PER-ROW ACTIONS, added 2026-09-03: "Put a white
                          button and a black button on the space i marked for
                          each website. Their function mirrors the function of
                          the two buttons i marked in S1."
                          S1 was this page's own detail header, so these are its
                          Error History and View list buttons, per site, square
                          and icon-only to fit a w-64 rail. Same colours as the
                          header pair: outline-white for Error History, solid
                          black for View list, so the primary action reads as
                          primary in both places.
                          The white/black pairing carries the hierarchy, and the
                          `title` carries the meaning that dropping the labels
                          costs. Icons: AlertTriangle, which is what this app
                          already uses for errors in six other places, and List,
                          the same icon the Tools section uses for a list view.
                          ⚠️ These replaced a red lifetime-error COUNT badge that
                          sat here until earlier the same day. Do not re-add it;
                          the status dot beside the name already signals trouble
                          by recency, and the count is in the detail panel. */}
                      <span className="flex shrink-0 items-center gap-1">
                        <Link
                          href={`/automations/${site.slug}/errors`}
                          aria-label={`${site.label} error history`}
                          title="Error History"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-zinc-600 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                        >
                          <AlertTriangle className="h-3 w-3" />
                        </Link>
                        <Link
                          href={`/automations/${site.slug}`}
                          aria-label={`${site.label} automation list`}
                          title="View list"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-white transition-colors hover:bg-zinc-800"
                        >
                          <List className="h-3 w-3" />
                        </Link>
                      </span>
                    </div>
                  );
                })}
              </nav>

              <div className="border-t p-2">
                <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Tools
                </div>
                {/* ⚠️ REAL LINKS, where Alpha3 renders decorative spans. These
                    three are the only route to those pages from this page: the
                    card design's toolbar strip does not exist here. */}
                <RailTool
                  href="/automations/feature-integration"
                  icon={Plug}
                  label="Feature Integration"
                />
                <RailTool
                  href="/automations/all"
                  icon={List}
                  label="View All Lists"
                />
                <RailTool
                  href="/automations/dropdown-config"
                  icon={ListChecks}
                  label="Dropdown Configuration"
                />
              </div>
            </div>

            {/* ---- Detail panel for the selected website. ---- */}
            <div className="min-w-0 flex-1">
              {/* Header, tinted with the website's own colour so the panel
                  changes character as you move down the rail. */}
              <div
                className="border-b px-6 py-5"
                style={{
                  background: `linear-gradient(to bottom, ${accent}0F, transparent)`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-foreground/10"
                    >
                      <SiteGlyph site={selected} className="h-7 w-7" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-xl font-semibold text-zinc-900">
                          {selected.label}
                        </h2>
                        <StatusPill tone={status.tone} label={status.label} />
                        {/* ⭐ THE AUTO-REFRESH INDICATOR, copied from the live
                            hub's footer strip and placed here by the user on
                            2026-09-03 ("copy the feature in S1 and put it in
                            the location on S2"). Icon goes emerald when on,
                            zinc when off, and the label says which, so it reads
                            without relying on colour alone.
                            Display-only, same as on the live hub: the real
                            toggle lives on each per-website page. `refreshOn`
                            is the same stored app-setting that toggle writes.
                            ⚠️ THIS DUPLICATES THE META STRIP'S "AUTO-REFRESH"
                            CELL below. The instruction was to place this one,
                            not to remove that one, so nothing was removed;
                            raised with the user separately. */}
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
                          <RefreshCw
                            className={cn(
                              "h-3 w-3 shrink-0",
                              refreshOn ? "text-emerald-600" : "text-zinc-400",
                            )}
                          />
                          {refreshOn ? "Auto-refresh on" : "Auto-refresh off"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        {selected.description}
                      </p>
                    </div>
                  </div>
                  {/* ⚠️ REAL LINKS, where Alpha3 renders spans. */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/automations/${selected.slug}/errors`}
                      className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-zinc-600 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50"
                    >
                      Error History
                    </Link>
                    <Link
                      href={`/automations/${selected.slug}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-zinc-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                    >
                      View list
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                {/* ⚠️⚠️ WHAT USED TO BE HERE, and do not bring it back without
                    asking: Alpha3's FOUR FIGURE CARDS (Tracked / Active /
                    Paused / Errors in ring-outlined boxes) followed by a
                    standalone proportion bar with a three-part legend.
                    The user replaced both on 2026-09-03: "I liked the
                    statistics in S1. Replace these stuff in S2 with that."
                    S1 was the LIVE HUB, so the two blocks below are the live
                    page's own statistics treatment, brought over verbatim.
                    That also means the `Figure` helper lost its only caller.

                    WHY IT IS BETTER HERE: Alpha3's four boxes gave the total
                    and its own parts the same visual weight, so "115" competed
                    with the "16" and "99" that add up to it. Below, the total
                    leads and the split is a proportion. */}

                {/* ⭐ THE COUNTS BLOCK, from the live hub. The total at 3xl with
                    "automations" beside it, the split as two dotted figures on
                    the right, and a proportion bar under both. */}
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
                        {/* Active takes the website's own brand colour, so the
                            dot, the bar below and the rail's accent spine are
                            all the same colour for a given site. */}
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
                  {/* The split as one bar. Widths are percentages of the site's
                      OWN total, so the bar always fills; a website with 0
                      automations leaves it empty grey, which is the honest
                      picture. */}
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

                {/* ⭐ THE ERROR PANEL, from the live hub. One grey block with
                    the lifetime count, how long ago the last one was, and a
                    30-day bar chart. It brought the per-(platform, day) trend
                    query, `TREND_DAYS` and the `Sparkline` component back to
                    this page; Alpha3's layout had no home for any of them.
                    THE POINT OF IT: a big number that stopped growing reads
                    completely differently from one still growing. Make's 35 and
                    n8n's 599 look like the same kind of fact as bare figures,
                    which is exactly what the Errors figure card did.
                    ⚠️ THIS DUPLICATES THE META STRIP'S "LAST ERROR" CELL below,
                    which says the same "34d ago". The user's instruction covered
                    the statistics only, so nothing was removed; raised with them
                    separately. */}
                <div className="rounded-lg bg-zinc-50 p-3">
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
                    {/* User-set wording. Singular at 1, "today" at 0 because
                        the day count is FLOORED, and "not tracked yet" when the
                        platform has captured nothing ever (permanent for GHL,
                        GHL b2b and Zapier). */}
                    <span className="text-[11px] text-zinc-500">
                      {days === undefined
                        ? "not tracked yet"
                        : days === 0
                          ? "Last Error today"
                          : `Last Error ${days} day${days === 1 ? "" : "s"} ago`}
                    </span>
                  </div>
                  <Sparkline dayKeys={dayKeys} counts={trend} />
                </div>

                {/* ⚠️⚠️ THE META STRIP WAS REMOVED HERE ON 2026-09-03, at the
                    user's instruction: "Remove all these status indicators."
                    It was a four-column band on a grey ground: API KEY /
                    AUTO-REFRESH / LAST RUN / LAST ERROR.
                    WHY IT WENT: three of its four cells had come to repeat
                    something already on screen. API key = the "API Key
                    Integrated" button just below; Auto-refresh = the indicator
                    beside the status pill in the header; Last error = the error
                    panel's "Last Error N days ago". I raised that as a whole and
                    the user removed the band rather than the duplicates.
                    ⚠️ "LAST RUN" WENT WITH IT AND IS NOW NOWHERE ON THIS PAGE.
                    It was the one fact the strip uniquely carried. Flagged to
                    the user at removal; they can have it back beside the
                    auto-refresh indicator in one line if they want it.
                    That also retired the `max(last_run_at)` query, the
                    `lastRunByPlatform` map and the `Meta` component, so this is
                    ONE FEWER DATABASE ROUND TRIP per page load. Do not re-add
                    the query without a consumer for it. */}

                {/* ⚠️ THE ONE THING ALPHA3 DOES NOT HAVE, and now the ONLY place
                    the API key is reported on this page: Alpha3 kept the
                    API-key FACT in its status strip and dropped the CONTROL,
                    because it has no working controls at all. This page kept
                    the control, and the strip that held the fact is gone
                    (removed 2026-09-03), so this button carries both.
                    Clicking it runs a LIVE verify and re-colours on the result,
                    and it is what the "API Health Check" button at the top of
                    the page drives.
                    Only the boolean reaches the client; the secret never does. */}
                <div className="flex items-center gap-2">
                  <CopyApiKeyButton
                    platform={selected.slug}
                    hasApiKey={hasKey}
                    initialOk={health.results[selected.slug]?.ok}
                  />
                </div>

                {/* The two lists that only fit because this layout gave one
                    website the whole canvas. */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* ⚠️ RECENTLY EDITED IS DELIBERATELY FIRST. Alpha3 had
                    Latest errors on the left; the user swapped them on
                    2026-09-03 ("switch the position of the 'recently edited'
                    and 'last errors' cards"). Do not reorder back to match
                    Alpha3.
                    Both are PANEL_ROWS long and only fit at all because this
                    layout gives one website the whole canvas. */}
                  <Panel
                    title="Recently edited"
                    hint="on the website"
                    empty={recentlyEdited.length === 0}
                    emptyLabel="No edit dates recorded for this website."
                  >
                    {recentlyEdited.map((row) => (
                      <li key={row.id} className="px-3.5 py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-zinc-900">
                            {row.name}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                            {agoLabel(
                              row.lastEditedAt
                                ? new Date(row.lastEditedAt)
                                : null,
                            )}
                          </span>
                        </div>
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500">
                          <PencilLine className="h-3 w-3 shrink-0" />
                          {row.status === "active" ? "Active" : "Paused"}
                        </span>
                      </li>
                    ))}
                  </Panel>

                  <Panel
                    title="Latest errors"
                    hint={`newest ${PANEL_ROWS}`}
                    empty={siteErrors.length === 0}
                    emptyLabel={
                      hasKey
                        ? "No errors captured for this website."
                        : "Error capture is not available for this website."
                    }
                  >
                    {siteErrors.map((row) => (
                      <li key={row.id} className="px-3.5 py-2.5">
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
                      </li>
                    ))}
                  </Panel>
                </div>
              </div>
            </div>
          </div>
        </HealthCheckProvider>
      </TooltipProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces. All copied from Alpha3 except RailTool, which became a real link.
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

// -------------------------------------------------------------------------
// SITE STATUS: the tone + label behind the pill in the detail header AND the
// bare coloured dot on every rail row. Picked from Alpha3 with the rest
// of this design; reviewed and accepted by the user on 2026-09-03 ("the
// feature seems fine"). It is the one per-site element the card design on
// /automations does not have.
//
// A FOUR-RUNG LADDER, FIRST MATCH WINS, from exactly two inputs:
//
//   1. no API key                      -> "Not connected"   (grey)
//   2. last error 0 or 1 days ago      -> "Erroring"        (red)
//   3. last error 2 to 7 days ago      -> "Recent errors"   (amber)
//   4. anything else                   -> "Healthy"         (green)
//
// THE TWO INPUTS, and the second one is the subtle one:
//   - `hasKey` = `platformHasApiKey()`, which checks the env vars are
//     PRESENT. Make wants a token; n8n wants a key AND a base URL; each GHL
//     wants a token AND a location id; Zapier always returns false.
//   - `days` = whole days since the most recent CAPTURED error, floored.
//     ⚠️ It is `undefined`, not 0, when the platform has never captured one.
//     That is why rungs 2 and 3 both re-test `days !== undefined`: without
//     it, `undefined <= 1` would be false anyway, but the intent would be
//     unreadable.
//
// ⚠️⚠️ TWO ACCEPTED WEAKNESSES. Both are inherited from Alpha3, where this
// pill was a static visual and nothing depended on it. The user was shown
// both and judged the feature fine as-is, so DO NOT "fix" them unprompted.
//
//   (a) "Healthy" is ALSO what "cannot report otherwise" looks like. GHL and
//       GHL b2b have keys, and GHL error tracking is confirmed impossible via
//       their API ([[automations-ghl-error-api]]), so their `days` is
//       permanently undefined and they fall through to rung 4 forever. Same
//       for any platform that simply has not errored yet. The pill cannot
//       distinguish "verified fine" from "no evidence either way".
//       If this ever needs closing, the shape is a fifth rung: `days`
//       undefined AND the platform cannot capture -> "Not tracked".
//
//   (b) It reads key PRESENCE, never key VALIDITY. This page already loads
//       `health.results[slug].ok` (the last stored Auto-API health check) and
//       hands it to the CopyApiKeyButton below, but the pill does not look at
//       it. So a platform whose key is present but FAILING its last health
//       check still shows "Healthy" or "Erroring", never "Not connected".
// -------------------------------------------------------------------------
function siteStatus(
  hasKey: boolean,
  days: number | undefined,
): { tone: Tone; label: string } {
  return !hasKey
    ? { tone: "off", label: "Not connected" }
    : days !== undefined && days <= 1
      ? { tone: "bad", label: "Erroring" }
      : days !== undefined && days <= 7
        ? { tone: "warn", label: "Recent errors" }
        : { tone: "ok", label: "Healthy" };
}

/** The pill beside the selected website's name. PRESENTATION ONLY: it renders
 *  whatever tone and label it is handed. **The rules that choose them live in
 *  `siteStatus()` directly above, documented there.** Change the logic there,
 *  not here.
 *
 *  ⚠️ The RAIL does not use this component. It shows the same status as a bare
 *  coloured dot with no label, so it reads `TONE_DOTS` directly. Both get their
 *  tone from `siteStatus()`, which is why that ladder was lifted out of the
 *  component body: two callers, one set of rules. */
function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
        TONE_CLASSES[tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOTS[tone])} />
      {label}
    </span>
  );
}

/** The website's logo: a tinted CSS mask for the monochrome glyphs, a plain
 *  image for the full-colour ones. Shared by the rail and the panel header so
 *  the two never drift. */
function SiteGlyph({
  site,
  className,
}: {
  site: (typeof AUTOMATION_SITES)[number];
  className: string;
}) {
  if (site.iconColor) {
    return (
      <span
        aria-hidden
        className={cn("shrink-0", className)}
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
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={site.icon}
      alt=""
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

// NOTE: Alpha3's `Figure` helper (a big number over a small uppercase label, in
// a ring-outlined box) used to live here. It powered the four Tracked / Active /
// Paused / Errors cards, and went with them on 2026-09-03 when the live hub's
// statistics replaced that grid. It had no other caller.

/** ⭐ The error bar chart under the panel's count, from the live hub.
 *
 *  `dayKeys` comes in already built for the whole window, so a day with no
 *  errors still gets a bar (a flat 3px grey stub) instead of being skipped. A
 *  gap in the data then reads as a quiet day rather than as missing time.
 *
 *  ⚠️ Heights are relative to THIS site's own max, not a global one. A site with
 *  a single error still shows a readable bar, at the cost of the sites not being
 *  comparable by height. Deliberate: only one site is on screen here, which
 *  makes it even less of a trade-off than it was on the card grid. */
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
              // The 12% floor keeps a 1-error day from rendering as a hairline
              // next to a 40-error day. Zero days get a flat 3px stub instead.
              height:
                max > 0 && v > 0 ? `${Math.max(12, (v / max) * 100)}%` : "3px",
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

// NOTE: the `Meta` helper (an icon + uppercase label over a toned value)
// used to live here. It rendered the four-column status strip and went with it
// on 2026-09-03. No other caller.

function Panel({
  title,
  hint,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  hint: string;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3.5 py-2">
        <span className="text-xs font-semibold text-zinc-800">{title}</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {hint}
        </span>
      </div>
      {empty ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <Inbox className="h-5 w-5 text-zinc-300" />
          <p className="text-xs text-zinc-500">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </div>
  );
}

/** ⚠️ A real <Link>, where Alpha3 renders a decorative <span>. */
function RailTool({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-3 w-3 shrink-0 text-zinc-300" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Time labels. Coarse on purpose: these are glanceable states, not timestamps,
// and the exact values still live on the per-website pages.
//
// ⚠️ Reads `Date.now()` at RENDER time, which is fine only because this page is
// `dynamic = "force-dynamic"`. It does not tick while the page sits open.
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
