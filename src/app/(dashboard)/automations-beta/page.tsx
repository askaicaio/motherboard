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
  // NOTE: `stats` (this site's total/active/paused) and the `activePct` /
  // `pausedPct` pair were read here for the panel's counts block. All three
  // went with it on 2026-09-03; see the note at the top of the panel body.
  // `statsByPlatform` itself stays, because the rail rows and
  // `portfolioTotal` both read it.
  const accent = ACCENT[selected.slug];
  const hasKey = platformHasApiKey(selected.slug);
  const days = daysSinceErrorByPlatform[selected.slug];
  const errors = errorCounts[selected.slug] ?? 0;
  // This site's per-day error counts over the window. `{}` for a platform that
  // has captured nothing, which draws a flat baseline.
  const trend = trendByPlatform[selected.slug] ?? {};
  // NOTE: `refreshOn` (this site's stored auto-refresh setting) and `status`
  // (`siteStatus(hasKey, days)`) were read here for the detail header's pill and
  // auto-refresh indicator. Both went with those on 2026-09-04; see the note in
  // the header. `autoRefreshMap` and `siteStatus()` are still read PER RAIL ROW,
  // so neither the query nor the ladder was lost.
  // `hasKey` and `days` survive on their own account: `hasKey` feeds the
  // CopyApiKeyButton and the Latest errors empty-state, `days` the error panel's
  // "Last Error N days ago".

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
            {/* ⚠️ w-[40rem] (640px). WIDENED FIVE TIMES FROM Alpha3's w-64:
                    w-80 then 416px on 2026-09-03, then 448px, 672px and 640px
                    on 2026-09-04. It is more than half the pane on a 1440px
                    screen, a deliberate rebalancing of the layout rather than
                    a nudge.
                    ⚠️ THE 672 -> 640 TRIM IS A ROUND-NUMBER PREFERENCE, not a
                    fix ("make the 672px into 640px"). Nothing needed the 32px
                    back, so do not go looking for the reason.
                    ⚠️⚠️ THE LAST TWO STEPS ARE THE ONLY ONES NOT DRIVEN BY
                    CONTENT. Every earlier widening was the minimum some element
                    needed. 672 was a proportion the user asked for outright:
                    "Make this section wider, you can decrease the width of the
                    stuff on the right side to accomodate it. Make the left side
                    roughly x1.5 times as wide." 448 x 1.5 = 672 exactly.
                    So the cards now have far MORE room than their content
                    needs (the title line's worst case is 264px against a 514px
                    text column). THE SLACK IS THE POINT. Do not "reclaim" it,
                    and do not read the empty right-hand side of a card as a
                    layout bug.
                    ⚠️ 448px REMAINS THE CONTENT FLOOR, and that is what the
                    measurements below are about: the whole counts statistic
                    ("You can widen the cards on the left to accomodate it") and
                    the full status indicators ("Resize it as needed") need it
                    between them. Below 448 the site name truncates.
                    ⚠️ MEASURED IN THE BROWSER at a 1900px viewport, rather than
                    reasoned about, at 416 and 448. At 448px an unselected card
                    is 355px wide (selected or not, because the row reserves the
                    action buttons' width either way) with a 290px text column,
                    and the two lines need:
                      TITLE LINE, worst case "GHL b2b" + the longest status
                      label ("Recent errors") + "Auto-refresh on" = 264px,
                      so 26px slack.
                      STAT LINE, worst case "344 automations" against "144
                      active / 200 paused" = 235px, so 55px slack.
                    ⚠️ SO THE TITLE LINE IS NOW THE BINDING CONSTRAINT, not the
                    statistic. At the previous 416px the title line needed 264
                    against a 258px column and **"GHL b2b" truncated to
                    "GHL b2..."**, which is what bought the extra 32px. If you
                    narrow this, the site NAME is what clips first, because both
                    indicators are `shrink-0`.
                    ⚠️ HISTORY, so the earlier reason does not read as stale:
                    the w-80 step existed only so the action buttons could be
                    square at the card's height, and the user narrowed those
                    buttons back to 32px the same day. I offered to hand that
                    64px back and they chose to keep the roomier cards. So
                    neither step is a leftover; do not "restore" w-64. */}
            <div className="flex w-[40rem] shrink-0 flex-col border-r">
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

              {/* space-y-1.5: each row is a bordered card as of 2026-09-03,
                  so they need air between them. Flush cards would butt their
                  borders into a doubled seam. */}
              <nav className="flex-1 space-y-1.5 p-2">
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
                  // For the row's own proportion bar, over THIS row's total, so
                  // a website with 0 automations leaves the bar empty grey
                  // instead of dividing by zero. These were the detail panel's
                  // `activePct`/`pausedPct` too until its counts block was
                  // removed on 2026-09-03; the rail is now the only caller.
                  const sActivePct = s.total ? (s.active / s.total) * 100 : 0;
                  const sPausedPct = s.total ? (s.paused / s.total) * 100 : 0;
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
                    // ⚠️ `items-stretch` is what lets the two buttons match the
                    // card's height. The card sizes itself from its two lines of
                    // text; the buttons inherit that height rather than
                    // hard-coding one, so they stay level if the text changes.
                    // The row itself now carries NO padding or background: the
                    // card below owns both.
                    <div
                      key={site.slug}
                      className="flex h-[76px] items-stretch gap-2"
                    >
                      {/* ⭐ THE CARD, 2026-09-03: "Place each of these in its own
                          card with visible borders." A real `border`, not the
                          faint `ring-1 ring-foreground/10` used elsewhere on this
                          page, because "visible" was the ask. Selected rows keep
                          the zinc-100 fill; the rest are card-white and tint on
                          hover.
                          ⚠️ The two action buttons are deliberately OUTSIDE this
                          card ("The two buttons on the right side should be
                          outside the card in the same spot"), which is also what
                          the invalid-nested-anchor rule requires anyway.

                          ⚠️⚠️ THE CARD IS A <Link> AGAIN, AND THAT IS THE STATE
                          TO KEEP. It was briefly a <div> on 2026-09-04 so the
                          API-key button could live inside it (PR #458): a real
                          <button> cannot sit inside an <a>. The user reverted
                          that move ("return these elements to their last
                          location, it doesn't look good here"), so the card has
                          no interactive children again and can be the Link
                          itself.
                          📌 SO THE CARD HOLDS THREE BLOCKS, NOT FIVE. The
                          error block and the API-key button were tried here and
                          sent back; the note above the error panel in the
                          detail panel records why (the card went 76px -> 218px
                          and the rail to 1339px). **Anything with a real button
                          in it cannot come here without making the card a div
                          again, and anything tall should not.** */}
                      <Link
                        href={`/automations-beta?site=${site.slug}`}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
                          isCurrent
                            ? "bg-zinc-100"
                            : "bg-card hover:bg-zinc-50",
                        )}
                      >
                        {/* Accent spine, full opacity on the selected row and
                          faint on the rest, so the current website is obvious
                          without a second indicator.
                          ⚠️ `self-stretch` RATHER THAN THE OLD FIXED `h-7`. The
                          card grew from 56px to 76px when the counts statistic
                          landed in it on 2026-09-03, and a centred 28px dash in
                          a 76px card reads as a leftover rather than an edge.
                          This was my call, not the user's ask; `h-7` is a
                          one-word revert if they prefer the shorter dash. */}
                        <span
                          aria-hidden
                          className="w-[3px] shrink-0 self-stretch rounded-full"
                          style={{
                            backgroundColor: ACCENT[site.slug],
                            opacity: isCurrent ? 1 : 0.35,
                          }}
                        />
                        <SiteGlyph site={site} className="h-5 w-5" />
                        {/* `flex-col` with a real gap, because this column
                          holds TWO blocks now (the title line, then the counts
                          statistic) rather than two lines of text. */}
                        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                          {/* ⭐ THE TITLE LINE reads: Name (dot) (refresh icon).
                            The user sketched it as "(.) Make (Green Refresh
                            Icon)" on 2026-09-03 and then moved the dot the same
                            day: "Put the dot after the website title instead,
                            but before the refresh icon." So the ORDER IS
                            DELIBERATE and is not the sketch; do not restore the
                            leading dot.
                            ⚠️⚠️ BOTH INDICATORS WERE LABEL-LESS UNTIL 2026-09-04,
                            AND THE LABELS ARE NOW BACK. Do not restore the bare
                            versions from the history below.
                            The sequence, so neither instruction reads as lost:
                            the user first stripped them ("remove the text on
                            the colored dot so the pill only has the colored
                            dot") when the rail was `w-64` and everything in it
                            was being cut for width, then asked for the full
                            ones back once the rail was roomier: "I like the
                            complete status indicators marked in S1. Pls replace
                            the shortened indicators marked in S2 with the ones
                            in S1." S1 was this page's own detail header.
                            ⚠️ SO THESE ARE THE HEADER'S ACTUAL COMPONENTS, not
                            lookalikes: the same `StatusPill` and the same
                            icon-plus-label auto-refresh markup, at the same
                            sizes. Keep them in step with the header; the point
                            of the change was that the two places match.
                            `title` is kept on the auto-refresh indicator only
                            as a courtesy now that both read in words.
                            ⚠️ This is a FLEX row, so the name keeps `truncate`
                            and needs `min-w-0` to shrink; both indicators are
                            `shrink-0` so the name yields first. */}
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
                            <StatusPill
                              tone={siteStat.tone}
                              label={siteStat.label}
                            />
                            <span
                              title={
                                siteRefreshOn
                                  ? "Auto-refresh on"
                                  : "Auto-refresh off"
                              }
                              className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-zinc-500"
                            >
                              <RefreshCw
                                className={cn(
                                  "h-3 w-3 shrink-0",
                                  siteRefreshOn
                                    ? "text-emerald-600"
                                    : "text-zinc-400",
                                )}
                              />
                              {siteRefreshOn
                                ? "Auto-refresh on"
                                : "Auto-refresh off"}
                            </span>
                          </span>
                          {/* ⭐ THE COUNTS STATISTIC, per row, 2026-09-03: "Pls
                            replace the 'X Tracked' info under the website name
                            with the whole statistic i marked."
                            It began as the DETAIL PANEL'S counts block scaled
                            to the rail: the total leads, "automations" sits
                            beside it, the active/paused split is two dotted
                            figures on the right, and the proportion bar runs
                            under both.
                            ⚠️⚠️ AND IT IS NOW THE ONLY COPY. The panel's
                            larger version was removed hours later the same day
                            ("Remove this statistic") precisely BECAUSE the rail
                            had it: the selected row was showing the same figures
                            a few hundred pixels away. So this is not a smaller
                            echo of something else any more, it is where the
                            active/paused split lives. Treat it as load-bearing,
                            and see the note at the top of the panel body before
                            putting a headline count back over there.
                            ⚠️⚠️ THIS IS WHERE "{s.total} tracked" USED TO BE,
                            and that line had already been cut and restored
                            earlier the same day ("Remove the 'Tracked' text
                            here", then "Return the 'tracked' text we removed
                            just now"). The restore is SUPERSEDED, not reversed:
                            the number is still here, it just leads a bigger
                            block now. Do not re-add a separate "tracked" line.
                            ⚠️ WIDTH IS THE FRAGILE PART. The legend is
                            `shrink-0` so it never wraps, and "automations"
                            carries `truncate` so it is what clips first if a
                            later change squeezes the rail. Read the rail width
                            note further up before narrowing anything. */}
                          <span className="block">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="flex min-w-0 items-baseline gap-1">
                                <span className="font-heading text-lg font-semibold leading-none tabular-nums text-zinc-900">
                                  {s.total}
                                </span>
                                <span className="truncate text-[10px] text-zinc-500">
                                  automations
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2 text-[10px] text-zinc-600">
                                <span className="flex items-center gap-1">
                                  {/* Active wears the website's own brand
                                    colour, so this dot, the bar below it and
                                    the accent spine to its left are all the
                                    same colour for a given site. */}
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{
                                      backgroundColor: ACCENT[site.slug],
                                    }}
                                  />
                                  <span className="font-semibold tabular-nums text-zinc-900">
                                    {s.active}
                                  </span>
                                  active
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                                  <span className="font-semibold tabular-nums text-zinc-900">
                                    {s.paused}
                                  </span>
                                  paused
                                </span>
                              </span>
                            </span>
                            {/* The split as one bar. Widths are percentages of
                              the row's OWN total, so the bar always fills. */}
                            <span className="mt-1.5 flex h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                              <span
                                style={{
                                  width: `${sActivePct}%`,
                                  backgroundColor: ACCENT[site.slug],
                                }}
                              />
                              <span
                                className="bg-zinc-300"
                                style={{ width: `${sPausedPct}%` }}
                              />
                            </span>
                          </span>
                        </span>
                      </Link>

                      {/* ⭐ PER-ROW ACTIONS, added 2026-09-03: "Put a white
                          button and a black button on the space i marked for
                          each website. Their function mirrors the function of
                          the two buttons i marked in S1."
                          S1 was this page's own detail header, so these are its
                          Error History and View list buttons, per site, and
                          icon-only to fit a w-64 rail. Same colours as the
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
                          by recency, and the count is in the detail panel.

                          ⚠️ SIZING: `w-8` (32px) wide, FULL CARD HEIGHT via the
                          row's `h-[76px]` + `items-stretch`. So 32 x 76, tall
                          rectangles rather than squares. They followed the card
                          up from 56px on their own when the counts statistic
                          landed in it; sizing them by `items-stretch` instead
                          of a hard-coded height is exactly what that buys.
                          ⚠️ THEY WERE BRIEFLY SQUARE (`w-14`, 56 x 56) and the
                          user narrowed them the same day: "make these buttons
                          narrower, about as narrow as it was before." Square is
                          NOT the target; do not restore `w-14`.
                          ⚠️⚠️ AND DO NOT REACH FOR `aspect-square` EITHER. It
                          looks like the obvious tool and it is broken here.
                          MEASURED IN THE BROWSER 2026-09-03: flex sizes these
                          items from their CONTENT (a ~14px icon), `shrink-0`
                          stops them shrinking, and only THEN does `aspect-ratio`
                          paint them at the stretched height. The layout never
                          accounts for that painted width, so the row overflowed
                          the rail by 71px with the buttons spilling over the
                          detail panel, and widening the rail does not fix it
                          because the overflow scales too. A fixed width is the
                          only reliable way to size these. */}
                      {/* ⚠️⚠️ HIDDEN ON THE SELECTED ROW, BUT THE ROW STILL
                          RESERVES THEIR WIDTH. User, 2026-09-03: "make them
                          disappear and make the website card fill their space
                          when that specific website is currently selected",
                          then, having seen it: "When a website is selected,
                          make it so the card does not expand anymore. Leave the
                          empty space empty pretty much."
                          SO THE SECOND ASK REVERSES THE FIRST HALF OF THE
                          FIRST. The buttons still go; the card no longer grows
                          into the gap. Every card is now the same width in both
                          states, which is the point: a card that widened by
                          76px on selection made the whole rail jump.
                          ⚠️ THE SPACER IS THE BUTTON GROUP'S OWN CLASSES with
                          empty spans inside (`gap-1` + two `w-8`), NOT a single
                          hard-coded `w-[68px]`. Same literal tokens as the real
                          buttons a few lines down, so changing the button width
                          means changing `w-8` in all four places and a grep
                          finds them. Do not "simplify" it to one fixed width.
                          ⚠️ IT IS EMPTY SPANS, NOT `invisible` LINKS. Keeping
                          the real links and hiding them would auto-match the
                          width, but they would stay focusable and in the a11y
                          tree, and `aria-hidden` on a focusable element is an
                          a11y violation.
                          WHY THE BUTTONS GO AT ALL, rather than just tidier:
                          the detail panel on the right ALREADY shows Error
                          History and View list for whichever site is selected.
                          So for that one row the pair is a duplicate of what is
                          on screen a few hundred pixels away, and every OTHER
                          row is the only place to reach those two pages without
                          switching selection first. */}
                      {isCurrent ? (
                        <span
                          aria-hidden
                          className="flex shrink-0 items-stretch gap-1"
                        >
                          <span className="w-8" />
                          <span className="w-8" />
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-stretch gap-1">
                          <Link
                            href={`/automations/${site.slug}/errors`}
                            aria-label={`${site.label} error history`}
                            title="Error History"
                            className="inline-flex w-8 items-center justify-center rounded-md border bg-white text-zinc-600 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/automations/${site.slug}`}
                            aria-label={`${site.label} automation list`}
                            title="View list"
                            className="inline-flex w-8 items-center justify-center rounded-md bg-zinc-900 text-white transition-colors hover:bg-zinc-800"
                          >
                            <List className="h-3.5 w-3.5" />
                          </Link>
                        </span>
                      )}
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
            {/* ⚠️ `@container` IS LOAD-BEARING, added 2026-09-04 with the rail's
                jump to 672px. The Recently edited / Latest errors pair below
                used to split into two columns on a `lg:` VIEWPORT breakpoint,
                which cannot see that the rail has taken 672px out of this
                panel. That was already tight and the widening broke it: on a
                1440px screen the pair would have had about 184px per column
                while `lg:` still said "plenty of room". Making this an
                explicit container lets the pair respond to ITS OWN width
                instead. See the grid further down. */}
            <div className="@container min-w-0 flex-1">
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
                    {/* ⚠️⚠️ THE STATUS PILL AND THE AUTO-REFRESH INDICATOR WERE
                        REMOVED FROM HERE on 2026-09-04 ("Remove this status
                        indicators"), and this is the SECOND time this page has
                        shed a duplicate the same way. Do not put them back
                        without asking.
                        WHY IT IS NOT A REVERSAL of the two instructions that
                        put them here ("copy the feature in S1 and put it in the
                        location on S2" for the auto-refresh, and the pill which
                        came with Alpha3): both indicators moved INTO THE RAIL
                        CARDS a day earlier, one per website, in the header's own
                        components at the header's own sizes (#455). So the
                        selected row was showing this exact pair a few hundred
                        pixels to the left, and THIS was the copy that had become
                        redundant. Five of them replaced one.
                        📌 SAME SHAPE AS THE COUNTS BLOCK, which went from this
                        panel for the same reason on 2026-09-03: the user places
                        an element in the rail, sees the duplication, then clears
                        the panel's copy. Expect that rhythm, and read a removal
                        here as "the rail has it now", not as "we decided against
                        it".
                        WENT WITH THEM: the `status` and `refreshOn` locals. The
                        `siteStatus()` ladder and `StatusPill` both STAY, because
                        the rail rows are now their only callers. */}
                    <div className="min-w-0">
                      <h2 className="font-heading text-xl font-semibold text-zinc-900">
                        {selected.label}
                      </h2>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        {selected.description}
                      </p>
                    </div>
                  </div>
                  {/* ⚠️ REAL LINKS, where Alpha3 renders spans.
                      ⚠️ THE LEADING ICONS MATCH THE RAIL'S PER-ROW BUTTONS, and
                      that is the whole point of them: user, 2026-09-03, "Add
                      the icons of the 2 new buttons to their marked counterpart
                      in S1 respectively." The same AlertTriangle and List
                      appear on every rail row, so a glance ties the two
                      together and the rail's icon-only buttons become readable
                      without their tooltips.
                      ⚠️ KEEP THEM IN STEP: change an icon here and change the
                      matching rail button too, or the pairing that justifies
                      dropping the rail's labels stops holding.
                      View list keeps its TRAILING chevron as well, so it reads
                      icon + label + direction. Two glyphs on one small button is
                      deliberate: the List says what, the chevron says it
                      navigates away. */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/automations/${selected.slug}/errors`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Error History
                    </Link>
                    <Link
                      href={`/automations/${selected.slug}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                    >
                      <List className="h-3.5 w-3.5" />
                      View list
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                {/* ⚠️⚠️ THE PANEL DELIBERATELY OPENS ON THE ERROR PANEL, WITH
                    NO HEADLINE COUNT ABOVE IT. Two rounds of removals sit here,
                    both 2026-09-03, and NEITHER should be undone without
                    asking:
                    1. Alpha3's FOUR FIGURE CARDS (Tracked / Active / Paused /
                       Errors in ring-outlined boxes) plus a standalone
                       proportion bar with a three-part legend. The user
                       replaced them with the live hub's own treatment: "I liked
                       the statistics in S1. Replace these stuff in S2 with
                       that." That is what left the `Figure` helper with no
                       caller.
                       WHY THAT WAS RIGHT: Alpha3's four boxes gave the total
                       and its own parts the same visual weight, so "115"
                       competed with the "16" and "99" that add up to it.
                    2. Then THE COUNTS BLOCK that replaced them, which is what
                       stood here until "Remove this statistic": the total at
                       3xl with "automations" beside it, the active/paused split
                       as two dotted figures on the right, and a proportion bar
                       under both. It took `stats`, `activePct` and `pausedPct`
                       with it.
                    ⚠️ #2 IS NOT A REVERSAL OF #1, AND THE STATISTIC IS NOT
                    LOST. The same block had moved INTO THE RAIL CARDS earlier
                    the same day, one per website, so the selected row was
                    showing it a few hundred pixels from this panel's larger
                    copy. THIS copy was the duplicate that went. The statistic
                    is now on screen five times over instead of once, which is
                    more information, not less.
                    ⚠️ SO IF A HEADLINE NUMBER IS EVER WANTED HERE AGAIN, ask
                    first, and scale the RAIL's treatment up rather than
                    reviving either version above. */}

                {/* ⚠️⚠️⚠️ TRIED IN THE RAIL CARDS ON 2026-09-04 AND REVERTED THE
                    SAME DAY. Do not move this block, or the API-key button
                    below it, into the cards again without being asked.
                    The user asked for both ("move these two elements into each
                    of the respective website's cards", PR #458), saw it, and
                    reverted it: "return these elements to their last location,
                    it doesn't look good here."
                    ⚠️ WHY IT LOOKED WRONG, since the instinct behind it was
                    sound and someone will have it again. Every earlier move to
                    the rail traded one copy for five and each copy was SMALL:
                    a pill, a number, a legend. These two are not small. MEASURED
                    in the cards: the error block alone was 98px and the card
                    went 76px -> 218px, so the five cards came to 1128px and the
                    rail to 1339px against a detail panel of about 500px. The
                    rail stopped being a rail and the panel it was feeding sat
                    mostly empty. **The pattern has a size limit, and this is
                    where it was found.**
                    ⚠️ WHAT THE REVERT COST, and it is a real regression that
                    was NOT re-introduced by accident: see the API-key button's
                    own note below.
                */}

                {/* ⭐ THE ERROR PANEL, from the live hub. One grey block with
                    the lifetime count, how long ago the last one was, and a
                    30-day bar chart. It brought the per-(platform, day) trend
                    query, `TREND_DAYS` and the `Sparkline` component back to
                    this page; Alpha3's layout had no home for any of them.
                    THE POINT OF IT: a big number that stopped growing reads
                    completely differently from one still growing. Make's 35 and
                    n8n's 599 look like the same kind of fact as bare figures,
                    which is exactly what the Errors figure card did.
                    ⚠️ IT USED TO DUPLICATE THE FOUR-COLUMN META STRIP'S "LAST
                    ERROR" CELL, which said the same "34d ago". That strip is
                    gone ("Remove all these status indicators"), so this is now
                    the only place the days-since figure appears. */}
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
                    Clicking it runs a LIVE verify and re-colours on the result.
                    Only the boolean reaches the client; the secret never does.

                    ⚠️⚠️ KNOWN GAP, MEASURED, NOT A GUESS: "API HEALTH CHECK" AT
                    THE TOP OF THIS PAGE ONLY RE-CHECKS THE SELECTED WEBSITE.
                    This button registers itself with HealthCheckProvider, and
                    `runAll` fires every REGISTERED check. There is exactly one
                    of these mounted here (the selected site), so the fan-out
                    has one member. The live hub renders five, one per card, and
                    its button really does check all five.
                    ⚠️ THIS WAS ACCIDENTALLY FIXED AND THEN DELIBERATELY
                    RE-INTRODUCED. Putting a button in every rail card (PR #458)
                    gave the provider five registrations and the fan-out worked
                    properly; the user reverted that move for layout reasons
                    ("it doesn't look good here"), which brought the gap back.
                    So it is a known cost of a chosen layout, NOT an oversight.
                    📌 THE FIX, when it is wanted, is NOT to put the buttons
                    back in the cards. Either register the four unselected
                    platforms without rendering their buttons, or let the
                    fan-out iterate the platform list server-side instead of
                    depending on what happens to be mounted. Raised with the
                    user; not taken up yet.
                    📌 THE GENERAL LESSON: a component that self-registers with
                    a provider changes BEHAVIOUR with how many of it you render.
                    Count the instances, not just the markup. */}
                <div className="flex items-center gap-2">
                  <CopyApiKeyButton
                    platform={selected.slug}
                    hasApiKey={hasKey}
                    initialOk={health.results[selected.slug]?.ok}
                  />
                </div>

                {/* The two lists that only fit because this layout gave one
                    website the whole canvas.
                    ⚠️ A CONTAINER QUERY, NOT A VIEWPORT ONE, since 2026-09-04.
                    It was `lg:grid-cols-2`, which asks the WINDOW whether there
                    is room for two columns; the answer is useless here because
                    the rail decides how much of the window this panel actually
                    gets, and the rail is 672px. `@min-[640px]` asks the PANEL
                    instead (its parent carries `@container`), so the pair
                    stacks whenever the panel itself is narrow, at any window
                    size and at any future rail width.
                    WHY 640px: each column wants ~280px to hold an error message
                    without shredding it. 2 x 288 + the 16px gap + this section's
                    48px of padding lands just under 640. */}
                <div className="grid gap-4 @min-[640px]:grid-cols-2">
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
// SITE STATUS: the tone + label behind the pill on every rail row. It used to
// feed the detail header's pill as well; the rail took the same pill on
// 2026-09-04 and the header's copy was removed as the duplicate.
// Picked from Alpha3 with the rest
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
 *  ⚠️ THE RAIL ROWS ARE ITS ONLY CALLER NOW, five at a time, so a change here
 *  changes every row of the rail. Two moves on consecutive days got it there:
 *  the rail swapped its bare `TONE_DOTS` dot for this pill on 2026-09-04 so the
 *  two places would read identically, and the detail header's copy was then
 *  removed as the duplicate. The tone and label still come from `siteStatus()`,
 *  which is why that ladder sits outside this component body even now that only
 *  one caller is left: it is the RULES, and they are worth reading separately
 *  from the markup. */
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
