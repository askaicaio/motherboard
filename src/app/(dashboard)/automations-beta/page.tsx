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
//   - Error History, View list and the three rail Tools are all real <Link>s.
//   - the API status button is the real CopyApiKeyButton, which runs a LIVE
//     verify on click.
//
// ⚠️ WHAT THIS PAGE HAS THAT ALPHA3 DOES NOT, all at the user's direction:
//   - the CopyApiKeyButton. Alpha3 kept the API-key FACT in a status strip and
//     dropped the CONTROL, having no working controls at all. Beta kept the
//     control; the strip itself was removed on 2026-09-03, so this button is
//     now the only place the API key is reported.
//   - VIEW LIST ON EVERY RAIL CARD, labelled, always visible, where Alpha3 has
//     nothing per row at all, AND ERROR HISTORY ONCE, IN THE DETAIL HEADER.
//     ⚠️⚠️ THESE BUTTONS HAVE BEEN THROUGH FOUR ARRANGEMENTS IN THREE DAYS AND
//     THEY ARE SPLIT NOW, so read the whole sequence before "restoring"
//     anything:
//       1. ICON-ONLY, 32px, hidden on the selected row, beside each card
//          (#443-#447). Removed 2026-09-04, "Remove these buttons" (#463).
//       2. the LABELLED pair in the DETAIL HEADER only, which is where they
//          lived while the rail had none.
//       3. the labelled pair PER CARD, always visible, the header giving them
//          up entirely ("Move these buttons to each website card. They are
//          always visible", #464).
//       4. NOW: SPLIT. View list stays on every card; Error History went back
//          to the header ALONE on 2026-09-06 ("Move these buttons the 'Error
//          History button' to the blank space I marked for each website's
//          right side card", #467).
//     So #463 removed the ICON-ONLY treatment, not the idea of per-card
//     buttons, and #467 did NOT undo #464 for View list. **Do not re-add the
//     hide-on-selected gate**: it existed because the header showed the SAME
//     pair, and the header now holds only the button the cards do not.
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
// the cards' Error History button uses it rather than introducing a second one.
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
  // `hasKey` and `days` survive on their own account: `hasKey` now feeds ONLY
  // the Latest errors empty-state (the CopyApiKeyButton it used to feed moved
  // to the rail cards on 2026-09-04 and reads its own `siteHasKey` per row),
  // and `days` the error panel's "Last Error N days ago".

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
            {/* ⚠️ w-[600px]. WIDENED FIVE TIMES FROM Alpha3's w-64 AND THEN
                    TRIMMED TWICE: w-80, then 416px on 2026-09-03, then 448px,
                    672px and 640px on 2026-09-04, then 600px on 2026-09-06.
                    It is still a third of the pane on a 1900px screen, a
                    deliberate rebalancing of the layout rather than a nudge.
                    ⚠️ BOTH TRIMS ARE ROUND-NUMBER PREFERENCES, not fixes
                    ("make the 672px into 640px", then "now pls make it 600px").
                    Nothing needed the 72px back, so do not go looking for the
                    reason.
                    ⚠️⚠️ THE LAST THREE STEPS ARE THE ONLY ONES NOT DRIVEN BY
                    CONTENT. Every earlier widening was the minimum some element
                    needed. 672 was a proportion the user asked for outright:
                    "Make this section wider, you can decrease the width of the
                    stuff on the right side to accomodate it. Make the left side
                    roughly x1.5 times as wide." 448 x 1.5 = 672 exactly.
                    So the cards still have MORE room than their content needs.
                    THE SLACK IS THE POINT. Do not "reclaim" it, and do not read
                    the empty right-hand side of a card as a layout bug.
                    ⚠️⚠️ THE CONTENT FLOOR IS 571px, NOT the 448px this note
                    claimed until 2026-09-06. 448 was measured BEFORE the Error
                    History + View list pair moved into the title row (#465).
                    That pair is 225px and it comes out of the NAME's share of
                    the title line, so it lifted the floor by 123px. The old
                    number is not a safe fallback any more.
                    ⚠️ MEASURED IN THE BROWSER at a 1920px viewport on
                    2026-09-06, BEFORE shipping 600, with this exact markup and
                    the live figures. At 600 every card is 583px wide with a
                    518px content column, all five are 120px tall, and nothing
                    truncates:
                      TITLE LINE, worst case ZAPIER ("Zapier" + "Not connected"
                      + "Auto-refresh off") = 256px against the 285px the pair
                      leaves it, so 29px slack. THAT 29px IS THE WHOLE MARGIN
                      and it is why the floor is 571. Every other site has
                      50-81px.
                      STAT LINE and the API bar are full-width siblings at
                      518px, so neither is anywhere near its limit.
                    ⚠️ SO THE TITLE LINE IS THE BINDING CONSTRAINT AND ZAPIER IS
                    THE WORST CASE, not GHL b2b as this note said while labels
                    were the only things on that line. Zapier carries the
                    longest status label ("Not connected") AND the longer
                    "Auto-refresh off". If you narrow below 600, the site NAME
                    clips first, because the pill and the refresh label are both
                    `shrink-0`.
                    ⚠️ HISTORY, so the earlier reason does not read as stale:
                    the w-80 step existed only so the action buttons could be
                    square at the card's height, and the user narrowed those
                    buttons back to 32px the same day. I offered to hand that
                    64px back and they chose to keep the roomier cards. So
                    neither step is a leftover; do not "restore" w-64. */}
            <div className="flex w-[600px] shrink-0 flex-col border-r">
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
                  // For this row's API-key button. `platformHasApiKey` only
                  // checks that the env vars are PRESENT; the button's green /
                  // red state is seeded from the last stored health-check
                  // result where there is one, and a click re-verifies live.
                  const siteHasKey = platformHasApiKey(site.slug);
                  // For the row's own proportion bar, over THIS row's total, so
                  // a website with 0 automations leaves the bar empty grey
                  // instead of dividing by zero. These were the detail panel's
                  // `activePct`/`pausedPct` too until its counts block was
                  // removed on 2026-09-03; the rail is now the only caller.
                  const sActivePct = s.total ? (s.active / s.total) * 100 : 0;
                  const sPausedPct = s.total ? (s.paused / s.total) * 100 : 0;
                  return (
                    // ⭐ THE CARD, 2026-09-03: "Place each of these in its own
                    // card with visible borders." A real `border`, not the faint
                    // `ring-1 ring-foreground/10` used elsewhere on this page,
                    // because "visible" was the ask. Selected rows keep the
                    // zinc-100 fill; the rest are card-white and tint on hover.
                    //
                    // ⚠️ THE CARD IS THE WHOLE ROW AGAIN as of 2026-09-04. For a
                    // day it sat inside a wrapper `<div className="flex
                    // items-stretch gap-2">`, because two icon buttons lived
                    // beside it and needed a flex row to stretch to the card's
                    // height. The user removed those buttons ("Remove these
                    // buttons"), so the wrapper had one child and nothing left
                    // to align. It went with them, and the card dropped the
                    // `min-w-0 flex-1` that only mattered inside it.
                    //
                    // ⚠️ HEIGHT IS CONTENT-DRIVEN. It was a fixed `h-[76px]`
                    // until the API-key button landed in the card on 2026-09-04;
                    // every card has the same three blocks so they all come out
                    // the same height anyway, and a hard-coded number would just
                    // be one more thing to keep in step.
                    //
                    // ⚠️⚠️ THE CARD IS A <div>, NOT THE SITE-SELECT <Link>, AND
                    // IT HAS TO BE. The API-key button lives in the card and it
                    // is a real <button>; AN INTERACTIVE ELEMENT INSIDE AN <a>
                    // IS INVALID HTML, which the browser silently un-nests,
                    // breaking both. So the Link covers the text column only and
                    // the button sits under it as a sibling. (The same trap
                    // applied to the old row wrapper while the icon buttons
                    // existed, which is why that was a div too.)
                    // ⚠️ WHAT THAT COSTS: the accent spine and the logo are
                    // outside the Link, so clicking them no longer selects the
                    // site. The Link still covers the name and the statistic. If
                    // the logo must be clickable again, the fix is an `absolute
                    // inset-0` overlay Link with the button lifted above it,
                    // NEVER putting the button back inside an anchor.
                    //
                    // 📌📌 THE CARD HOLDS THREE BLOCKS AND THAT IS A CEILING
                    // FOUND THE HARD WAY. On 2026-09-04 the error block came
                    // here too (PR #458) and the card went 76px -> 218px, the
                    // rail to 1339px; the user sent BOTH back ("it doesn't look
                    // good here", #459) and then asked for the API-key button
                    // alone ("This should still result in a decently short card
                    // unlike the tall one before", #460). **The API bar is 28px
                    // and the error block was 98px: that difference is the whole
                    // story.** Before moving anything else in here, measure its
                    // height.
                    <div
                      key={site.slug}
                      className={cn(
                        "relative flex items-stretch gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
                        isCurrent ? "bg-zinc-100" : "bg-card hover:bg-zinc-50",
                      )}
                    >
                      {/* ⭐⭐ THE SITE-SELECT LINK IS A FULL-CARD OVERLAY, and
                          this is what lets the card hold buttons AND stay one
                          click target. It replaced a Link that wrapped the text
                          column on 2026-09-04.
                          WHY: the card now has THREE interactive controls in it
                          (Error History, View list, the API-key button) and
                          **an <a> may not contain any of them**. Wrapping the
                          text instead meant the pair had to sit outside that
                          column, which is what squeezed the statistic and the
                          API bar. An overlay solves both: the whole card
                          selects the website, and the real controls sit above
                          it on `relative z-10`.
                          ⚠️ THE THREE PARTS THAT MAKE THIS WORK, and it breaks
                          quietly if any is dropped:
                            1. `relative` on this card, so `inset-0` is the
                               card's box and not the page's.
                            2. this Link is POSITIONED, so it paints above the
                               card's static text. That is fine because it is
                               transparent, and it is why a click anywhere on
                               the text still selects the site.
                            3. every real control carries `relative z-10` to
                               climb back above it. **A control WITHOUT that
                               class is invisible to the mouse: the overlay
                               swallows the click and just re-selects the
                               site.** That is the failure mode to look for if a
                               button here ever stops responding.
                          ⚠️ `aria-label` because the Link has no text of its
                          own; without it the whole card is an unnamed link. */}
                      <Link
                        href={`/automations-beta?site=${site.slug}`}
                        aria-label={`Show ${site.label}`}
                        className="absolute inset-0 rounded-lg"
                      />
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
                      {/* ⚠️ `self-start`: the card is three blocks tall now,
                          and a vertically centred logo floated beside the
                          statistic instead of sitting level with the name. */}
                      <SiteGlyph
                        site={site}
                        className="h-5 w-5 shrink-0 self-start"
                      />
                      {/* The card's content column: THREE FULL-WIDTH ROWS, and
                          only the first of them shares its line with the button
                          pair.
                          ⚠️⚠️ THIS WAS BUILT WRONG FIRST AND THE FIX IS THE
                          POINT OF THIS SHAPE. On 2026-09-04 the pair was a
                          sibling of this WHOLE column, so it took 225px off the
                          full card height and squeezed the counts statistic and
                          the API-key bar into 323px along with it. The user:
                          "The last feature was implemented poorly. The elements
                          I marked should be going under the new buttons. Right
                          now they got squished, which isnt supposed to happen."
                          **So the pair now sits in the TITLE ROW only, and the
                          statistic and the API bar run the column's full
                          width UNDER it.** Do not lift the pair back out to be
                          a sibling of this column. */}
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
                        <div className="flex items-center gap-2">
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
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

                          {/* ⭐⭐ VIEW LIST, PER CARD. It arrived here as a PAIR
                              with Error History on 2026-09-04 ("Move these
                              buttons to each website card. They are always
                              visible", #464), and **Error History left again on
                              2026-09-06 for the detail header's empty right
                              side** ("Move these buttons the 'Error History
                              button' to the blank space I marked for each
                              website's right side card", #467).
                              ⚠️⚠️ THAT IS A SPLIT, NOT A REVERSAL OF #464. View
                              list did not move and must not follow it. The two
                              buttons answer different questions: View list is a
                              per-website destination you want reachable for all
                              five at once, while Error History only ever
                              answers "this website", and the panel beside it is
                              already about exactly one website. Five copies
                              were four more than that question needs.
                              ⚠️ "ALWAYS VISIBLE" IS STILL THE INSTRUCTION for
                              what is left: there is NO `!isCurrent` gate. The
                              selected card shows View list exactly like the
                              other four. Do not re-add the hide-on-selected
                              behaviour the old icon-only buttons had.
                              ⚠️ IT LIVES ON THE TITLE ROW, so it takes width
                              from the NAME and from nothing else. The statistic
                              and the API bar below are full-width siblings; see
                              the column's note above for why that matters.
                              ⚠️⚠️ THE WRAPPER SPAN STAYS EVEN WITH ONE CHILD.
                              `relative z-10` is what lifts it above the card's
                              overlay Link; strip the wrapper and the overlay
                              swallows the click and the button silently stops
                              working. `shrink-0` + the name's `min-w-0` means
                              the NAME truncates first, never this. */}
                          <span className="relative z-10 flex shrink-0 items-center gap-2">
                            <Link
                              href={`/automations/${site.slug}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                            >
                              <List className="h-3.5 w-3.5" />
                              View list
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </span>
                        </div>

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

                        {/* ⭐ THE API-KEY CONTROL, per row, 2026-09-04: "put
                            that 'API Key Integrated' inside their respective
                            website card". One per website, where the panel used
                            to show only the selected site's.
                            ⚠️ OUTSIDE THE SITE-SELECT <Link> ON PURPOSE: it is
                            a real <button> and an <a> may not contain one. See
                            the card's note above.
                            ⚠️ THE FLEX WRAPPER IS REQUIRED, not decoration: the
                            button carries `flex-1` and collapses without a flex
                            parent to fill.
                            ⭐⭐ THIS IS ALSO THE WHOLE OF THE "API HEALTH CHECK
                            SHOULD CHECK EVERY WEBSITE" FIX, and it is worth
                            knowing why no separate code was written for it.
                            That button's entire body is `onClick={ctx.runAll}`,
                            and `runAll` fires every check REGISTERED with
                            HealthCheckProvider. Each of these buttons registers
                            itself on mount. One mounted meant a one-platform
                            fan-out; five mounted means all five, exactly as the
                            live hub has always worked. `runAll` also batches
                            the five results into one save of its own.
                            ⚠️ SO THE BUTTON'S CORRECTNESS DEPENDS ON THESE
                            BEING RENDERED. If a future layout takes them out of
                            the cards again, the fan-out silently narrows back
                            to whatever is left mounted. The durable fix, if
                            that happens, is to let `runAll` iterate
                            AUTOMATION_SITES server-side instead of depending on
                            what is on screen. (The 24h auto-check was never
                            affected: it runs server-side over every platform.)
                            Clicking one runs a LIVE verify of that platform and
                            re-colours on the result. Only the boolean reaches
                            the client; the secret never does.
                            ⚠️ `relative z-10` is REQUIRED, not styling: without
                            it the card's overlay Link swallows the click and
                            this button silently stops working. See the
                            overlay's note at the top of the card. */}
                        <span className="relative z-10 flex items-center gap-2">
                          <CopyApiKeyButton
                            platform={site.slug}
                            hasApiKey={siteHasKey}
                            initialOk={health.results[site.slug]?.ok}
                          />
                        </span>
                      </div>
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
                {/* ⚠️⚠️ THIS ROW WAS EMPTIED TWICE ON 2026-09-04 AND HAS ONE
                    CONTROL BACK: Error History, 2026-09-06, #467. Its own note
                    sits on the Link below.
                    ⚠️ WHAT DID NOT COME BACK, and must not: the status pill and
                    the auto-refresh indicator (#456). The rail cards show that
                    exact pair, five times, in this header's own components at
                    this header's own sizes, so THIS was the redundant copy.
                    Read a removal here as "the rail has it now", not as "we
                    decided against it". Same shape as the counts block, which
                    left this panel the same way on 2026-09-03.
                    ⚠️ `justify-between` and `flex-wrap` were kept on this row
                    for the whole two days it was empty, deliberately, for
                    exactly the case that then happened. `flex-wrap` is why a
                    control on the right cannot crush the name and description
                    on a narrow panel. */}
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

                  {/* ⭐⭐ ERROR HISTORY, 2026-09-06: "Move these buttons the
                      'Error History button' to the blank space I marked for
                      each website's right side card" (#467). The user marked
                      the button on a rail card and the EMPTY TOP-RIGHT of this
                      header, so it came out of all five cards and landed here
                      as ONE control, for whichever website is selected.
                      ⚠️⚠️ THIS IS THE THIRD TIME THIS BUTTON HAS MOVED and the
                      SECOND time it has been in this header, so read the whole
                      sequence before "restoring" anything: icon-only beside
                      each card (#443-#447) -> removed (#463) -> labelled, in
                      THIS header (with View list) -> onto every card (#464) ->
                      back here alone (#467). **View list stayed on the cards
                      this time**, which is what makes this a split rather than
                      a return to the #464 arrangement.
                      ⚠️ THE HEADER IS NO LONGER "NO CONTROLS AT ALL". The note
                      above used to call that the finished state; it was true
                      for two days. What IS still true is that the STATUS PILL
                      and the AUTO-REFRESH INDICATOR stay out (#456): they were
                      removed as duplicates of the rail's copies, and the rail
                      still has them. A control arriving here does not reopen
                      those.
                      ⚠️ SAME STYLING AS THE CARD'S VIEW LIST, deliberately:
                      `bg-card` reads as a real button against this header's
                      tint, and the user picked this treatment ("I like the way
                      these buttons are rendered").
                      ⚠️ `shrink-0` so the name and description yield first,
                      and the row's `flex-wrap` is what stops it crushing them
                      on a narrow panel. That class was left here deliberately
                      when the header was emptied, for exactly this.
                      ⚠️⚠️ MEASURED 2026-09-06, AND IT DOES WRAP ON A NARROW
                      PANEL. The button sits 24px off the panel's right edge,
                      top-aligned with the `<h2>` to the pixel, while the panel
                      is 520px or wider. **Below about 500px the row wraps and
                      the button drops to its own line, LEFT-aligned under the
                      description.** It never overflows, which is the whole
                      point of `flex-wrap`. Panel widths, rail at 600:
                      ~1030px at a 1920 viewport and ~550px at 1440, both fine;
                      **~390px at 1280, where the longer descriptions ("Workflows
                      found in GoHighLevel b2b") do wrap.** That is the same
                      1280 squeeze already noted on the rail width, not a new
                      problem, and the user chose the flat rail width knowing
                      1280 is cramped. Do not "fix" it with `whitespace-nowrap`
                      or a fixed width: those trade a graceful wrap for a
                      crushed name. */}
                  <Link
                    href={`/automations/${selected.slug}/errors`}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-card px-2.5 text-xs font-medium text-zinc-600 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Error History
                  </Link>
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

                {/* ⚠️⚠️⚠️ THIS BLOCK STAYS HERE. IT WAS TRIED IN THE RAIL CARDS
                    ON 2026-09-04 AND SENT BACK THE SAME DAY. Do not move it
                    into the cards again without being asked.
                    ⚠️ AND NOTE WHAT HAPPENED NEXT, or the record misleads: the
                    API-key button went to the cards WITH this block (PR #458),
                    both came back (#459), and then the user asked for the
                    BUTTON ALONE to go back in ("put that 'API Key Integrated'
                    inside their respective website card ... This should still
                    result in a decently short card unlike the tall one before",
                    #460). **So the button IS in the cards now and this block is
                    not. The two were not rejected together; only this one was.**
                    ⚠️ WHY THIS ONE IS THE PROBLEM, since the instinct behind
                    moving it was sound and someone will have it again. Every
                    move to the rail trades one copy for five, and it works when
                    each copy is SMALL: a pill, a number, a legend, a 28px
                    button. **This block is 98px.** MEASURED with it in the
                    cards: the card went 76px -> 218px, the five cards to
                    1128px, the rail to 1339px against a detail panel of about
                    500px. The rail stopped being a rail and the panel it was
                    feeding sat mostly empty.
                    📌 SO THE RULE IS NOT "nothing else moves to the cards", it
                    is **"measure its height first"**. 28px was fine. 98px was
                    not. */}

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
                    Integrated" button; Auto-refresh = the indicator beside the
                    status pill in the header; Last error = the error panel's
                    "Last Error N days ago". I raised that as a whole and the
                    user removed the band rather than the duplicates.
                    ⚠️ ALL THREE OF THOSE COUNTERPARTS HAVE SINCE MOVED TO THE
                    RAIL CARDS, one per website (2026-09-04). So the strip's
                    facts are on screen five times over now, not zero.
                    ⚠️ "LAST RUN" WENT WITH IT AND IS NOW NOWHERE ON THIS PAGE.
                    It was the one fact the strip uniquely carried. Flagged to
                    the user at removal; they can have it back beside the
                    auto-refresh indicator in one line if they want it.
                    That also retired the `max(last_run_at)` query, the
                    `lastRunByPlatform` map and the `Meta` component, so this is
                    ONE FEWER DATABASE ROUND TRIP per page load. Do not re-add
                    the query without a consumer for it. */}

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
