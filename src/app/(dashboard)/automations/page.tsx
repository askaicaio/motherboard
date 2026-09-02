// Automations Main Page, the LIVE hub at route /automations.
//
// ⚠️⚠️ THIS PAGE WAS REPLACED WHOLESALE ON 2026-08-31. It is the redesign that
// was built and proved on the Beta bench (`/automations-beta`), promoted here at
// the user's decision: "the current iteration of Beta is an improvement to the
// current official version. The plan right now is to ship the current beta
// version into the official automations page."
//
// The old hub is not gone, it is in git: everything before that date on this
// path. What it looked like, so a diff is not needed to picture it: five cards,
// each with a big icon beside the title, a "View List" button top right, an
// "Auto-refresh: ✓/✗" line, a "Days since last Error:" line, an "Error History"
// button, a four-column TOTAL / ACTIVE / PAUSED / ERRORS stat grid, and the API
// status button.
//
// ⭐ WHERE THE CURRENT DESIGN CAME FROM. Each element below is marked with a ⭐
// comment naming the Alpha version it was taken from and what the user said
// about it. Those markers are kept deliberately: they are the reason each piece
// looks the way it does, and several carry warnings that cost real time to
// learn (the strip's asymmetric padding, the `min-w-0` pairs, the flex-gap
// arithmetic). Do not strip them as stale history.
//
// ⚠️ THE BENCH IS STILL LIVE AND IS STILL A SEPARATE FILE. `/automations-beta`
// is once again an exact mirror of this page, ready for the next round of
// experiments. DO NOT extract shared components between the two: the whole
// point of the copy is that a Beta experiment cannot break this page. They are
// meant to diverge, and this file is promoted from that one only when the user
// says so.
//
// Picked from ALPHA (`/automations-alpha`) on 2026-08-29, the user's words:
// "I like these icon style, text and the funny colored shadow behind the
// rectangle":
//   1. ❌ the BRAND EDGE, a 3px bar in the website's colour across the card's
//      top (their "funny colored shadow"). Brought the local ACCENT map with it.
//      ⚠️ REMOVED 2026-08-31 at the user's request: "Can you remove these
//      colored shadows on the cards now. I think i doesn't look good now
//      actually." Kept listed, struck through, because the ACCENT map it
//      introduced is still load-bearing for picks 2 and 6. Do not put the bar
//      back; do not delete ACCENT.
//   2. the LOGO TILE, a rounded square washed in that colour at 12% alpha,
//      holding a 24px glyph, in place of the bare 32px icon.
//   3. the TEXT treatment, name and description stacked BESIDE the tile, the
//      name at the heading face and text-base, the description truncated at
//      text-xs in a lighter grey.
//   4. the ERROR PANEL: lifetime count + a "Last Error …" line + a 30-day bar
//      chart, in one grey block. Brought the per-(platform, day) trend query and
//      the `Sparkline` component with it.
//      User: "i like this error history graphic."
//   5. the FOOTER STRIP, between the counts row and the API status button:
//      auto-refresh state + "Last run Nh ago" on the left, Error History on the
//      right, in one muted band. (It carried View list too until 2026-08-31,
//      when the user moved that button up into the card header.) Brought the max(last_run_at)
//      query and `agoLabel` with it. "Last run" is NEW INFORMATION, not a
//      restyle. User: "i like this lower widget."
//      - The strip's error link arrived from Alpha as a quiet grey "Errors"
//        text link. The user promoted it to a button labelled "Error History"
//        and had the old outlined button removed, so the strip is now the only
//        route to that page from the card.
//   6. the COUNTS BLOCK, in place of the Total / Active / Paused column grid:
//      the total at 3xl with "automations" beside it, the split as two dotted
//      figures on the right, and a proportion bar under both. The `Stat` helper
//      went with the grid. User: "Replace the existing statistic with this."
//
// CARD ORDER, top to bottom: header, COUNTS BLOCK, ERROR PANEL, footer strip,
// API status button. The counts and the panel landed the other way round and the
// user swapped them ("switch the position of these two elements"), which also
// matches Alpha's own order: how big the website is reads first, its error
// history second. (A brand edge sat above the header until 2026-08-31.)
//
// ✅ THE DUPLICATES ARE RESOLVED. The card briefly said three things twice while
// the user compared both treatments on production; they then chose the STRIP's
// copy of every one ("alright, remove those two"). So each of these now appears
// EXACTLY ONCE, in the footer strip:
//   - auto-refresh state  (the "Auto-refresh: ✓/✗" row is gone, and with it the
//                          whole row it lived in)
//   - Error History       (the outlined button under the header is gone)
// ⚠️ Do not reintroduce either of them elsewhere on the card.
//
// ⚠️ "View list" WAS on that list and came back off it. The user moved the
// button into the CARD HEADER on 2026-08-31 and the strip gave up its copy, so
// the destination still appears exactly once. The rule is one copy each, not a
// fixed home.
//
// REMOVED as redundant once the error panel landed (the user asked for this in
// the same breath, "Remove redundant features after that"):
//   - the "Days since last Error" line. The panel says it as "last Nd ago" /
//     "not tracked yet", on the same row as the count it belongs to. Took the
//     `StatusMark` import with it.
//   - the "Errors" stat in the counts row, so that row is now THREE columns.
//     It was the same `errorCounts` figure the panel leads with.
//
// WHAT THE PAGE DOES: one card per automation website. Each card carries the
// site's total with its Active/Paused split as a proportion, an error panel
// (lifetime count, when the last one was, a 30-day bar chart), a footer strip
// with the auto-refresh state, when the site last ran, and links to its Error
// History and its list, then the API status button. Above the grid sit the
// health-check controls and the three global tools. The table / search /
// edit-mode features live on the per-website pages.
//
// ⚠️ TWO QUERIES ARRIVED WITH THE REDESIGN and are new to this page: a
// `max(last_run_at)` per platform for the strip's "Last run", and errors grouped
// by (platform, UTC day) over 30 days for the sparklines. Both are plain
// aggregates, but they are two more round trips on every load of the hub.
//
// ⚠️ `AutoRefreshStat` AND `StatusMark` ARE NO LONGER IMPORTED HERE. This page
// was their only caller (StatusMark is also used inside AutoRefreshStat), so
// both components are now unreferenced app-wide. Left in place on purpose
// rather than deleted alongside a live-page swap; remove them separately if
// they are still unused later.

import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automations, automationErrors } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
import {
  Workflow,
  Plug,
  List,
  ListChecks,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { CopyApiKeyButton } from "@/components/automations/copy-api-key-button";
// NOTE: two imports went away as the Alpha elements landed (2026-08-29), and
// neither is coming back:
//   - StatusMark, with the "Days since last Error" line. The error panel carries
//     that fact as "last Nd ago" / "not tracked yet".
//   - AutoRefreshStat, with the "Auto-refresh: ✓/✗" row. The footer strip
//     carries that state as "Auto-refresh on/off".
// `autoRefreshMap` is still read, by the strip.
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

// ---------------------------------------------------------------------------
// Per-website accent colour. COPIED VERBATIM from the Alpha pages, which each
// carry their own copy for the same reason: `sites.ts` only has `iconColor` for
// the sites whose glyph is a monochrome mask, but this treatment tints a logo
// tile and a brand edge for EVERY site, so all 5 need a colour. The two GHL
// subaccounts share the brand green at different weights: same family (they are
// the same product), still separable side by side.
//
// ⚠️ KEPT LOCAL ON PURPOSE, same as the Alphas: `sites.ts` is shared with the
// LIVE hub, and nothing in this experiment is allowed to reach that far. If a
// picked element ever ships to Official, promoting this map is a deliberate
// separate step.
// ---------------------------------------------------------------------------
const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

/** How many days of error history the per-card sparkline covers.
 *
 *  ⚠️ 30, NOT Alpha's 14. The user widened it on the bench before this design
 *  was promoted ("can you make this bar graph reach up to 30 days ago instead of
 *  14?"), so it deliberately differs from the Alpha element it came from.
 *
 *  THIS NUMBER IS THE ONLY PLACE TO CHANGE IT. It drives the SQL window, the
 *  `dayKeys` axis, and the caption under the bars (which renders
 *  `dayKeys.length`), so the three cannot fall out of step.
 *
 *  ⚠️ It also sets the bar count, and the bars share the panel's width with a
 *  fixed 3px gap between them. At 30 they are still comfortable on a normal
 *  window (roughly 15px each); pushing this much higher would start giving more
 *  width to the gaps than the bars, at which point the gap wants shrinking too. */
const TREND_DAYS = 30;

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

  // Total captured errors per platform. Now the big red figure in the error
  // panel picked from Alpha, rather than a bare "Errors" stat in the counts row
  // (getErrorCountsByPlatform omits platforms with no errors, so they read 0).
  const errorCounts = await getErrorCountsByPlatform();

  // Whole days since each platform's most recent captured error (computed in
  // SQL). Now the panel's "last Nd ago"; a platform absent here has captured
  // nothing, and reads "not tracked yet".
  const daysSinceErrorByPlatform = await getDaysSinceLastErrorByPlatform();

  // ⭐ PICKED FROM ALPHA: newest run time per website, for the footer strip's
  // "Last run" line. NEW DATA, not a restyle: neither the live hub nor Beta
  // showed anything about how recently a website last did work.
  const lastRunRows = await db
    .select({
      platform: automations.platform,
      lastRunAt: sql<Date | null>`max(${automations.lastRunAt})`,
    })
    .from(automations)
    .groupBy(automations.platform);

  // ⭐ PICKED FROM ALPHA: error counts per (platform, UTC day) over the trend
  // window, for the sparklines. Platforms with no capture come back empty and
  // draw a flat baseline, which is the correct picture for them: GHL, GHL b2b
  // and Zapier cannot capture errors at all.
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

  const lastRunByPlatform: Record<string, Date | null> = {};
  for (const row of lastRunRows) {
    lastRunByPlatform[row.platform] = row.lastRunAt
      ? new Date(row.lastRunAt)
      : null;
  }

  // ⭐ PICKED FROM ALPHA: the window's day keys, oldest first, built here rather
  // than from the rows that came back. Every sparkline then shares ONE x-axis,
  // and a day with no errors still gets a slot instead of collapsing the chart.
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

  return (
    <div className="space-y-6 p-6">
      {/* This page is a server component and had no TooltipProvider, unlike the
          three table clients which each carry their own. The card tooltips (the
          API status button, the Auto-API health check label) need one, and
          the shared TOOLTIP_DELAY_MS keeps the timing identical to the rest of the tab. */}
      <TooltipProvider delay={TOOLTIP_DELAY_MS}>
        <HealthCheckProvider>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-zinc-500" />
                <h1 className="text-2xl font-semibold tracking-tight">
                  Automations
                </h1>
                {/* ⚠️ NO VERSION BADGE HERE. The black pill belongs to the
                    experiment pages: Beta and the seven Alphas each wear one so
                    you can tell at a glance that you are not on the live hub.
                    This IS the live hub, so an unbadged title is the tell. */}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Tracks workflows from different automation websites all in one
                place.
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

          {/* Toolbar strip above the website cards, holding global Automations
          actions. Rounded edges to match the website cards below. Buttons
          (left → right): "Feature Integration" (Plug icon → the Feature
          Integration page), "View All Lists" (List icon → the combined
          Everything Table), then "Dropdown Configuration" (ListChecks icon →
          the Dropdown Config page). All white (outline) with a leading icon.

          ⚠️ TRIED AND ROLLED BACK, 2026-08-31 (PR #427, reverted same day).
          Alpha's Tools card replaced this strip: the same three destinations as
          a dashed-border cell holding icon + label + hint rows, placed FIRST in
          the grid at the user's direction. It shipped, and they dropped it:
          "lets roll back the previous change, it doesnt look good right now".
          WHY IT DID NOT WORK, worth knowing before anyone tries again: a
          three-row nav cell is far shorter than a website card, so the grid
          stretched it and left a large empty area under the rows. I offered
          four fixes (fold the estate totals in, fold the attention line in,
          `self-start` so it hugs its content, or spread the rows); the user
          took none of them and reverted instead. **So the shape of the problem
          is the card's HEIGHT, not its content or its placement.** */}
          <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5 ring-1 ring-foreground/10">
            <Link
              href="/automations/feature-integration"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Plug />
              Feature Integration
            </Link>
            <Link
              href="/automations/all"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <List />
              View All Lists
            </Link>
            <Link
              href="/automations/dropdown-config"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ListChecks />
              Dropdown Configuration
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
              // when the error table is empty for it, which the panel reads as
              // "not tracked yet".
              const daysSinceError = daysSinceErrorByPlatform[site.slug];
              // Lifetime captured errors, and this platform's per-day counts over
              // the trend window. An absent platform gets {}, a flat baseline.
              const errors = errorCounts[site.slug] ?? 0;
              const trend = trendByPlatform[site.slug] ?? {};
              // Active/Paused as percentages of this site's OWN total, for the
              // proportion bar. Guarded on total: a website with no automations
              // would otherwise divide by zero and the bar would come out
              // NaN-wide, which renders as nothing at all.
              const activePct = stats.total
                ? (stats.active / stats.total) * 100
                : 0;
              const pausedPct = stats.total
                ? (stats.paused / stats.total) * 100
                : 0;
              // This website's brand colour, for the logo tile, the "active" dot
              // and the proportion bar. (It also drove a 3px edge across the
              // card's top until 2026-08-31, when the user had that removed.)
              const accent = ACCENT[site.slug];
              return (
                // ⚠️ KEEP `py-0`. Card's own default is `py-4`, which would add
                // 16px on top of CardContent's `p-5`/`pb-3` at BOTH ends and
                // undo the measured 12px spacing below. `gap-0` is now a no-op
                // (CardContent is the only child) but is kept so re-adding a
                // second child cannot silently reintroduce Card's `gap-4`.
                //
                // ⚠️ THE BRAND EDGE USED TO BE THE FIRST CHILD HERE: a 3px bar in
                // the website's colour across the card's top, picked from Alpha
                // on 2026-08-29 as the user's "funny colored shadow". They had it
                // REMOVED on 2026-08-31: "Can you remove these colored shadows on
                // the cards now. I think i doesn't look good now actually."
                // Do not put it back. The accent still identifies each card via
                // the logo tile, the "active" dot and the proportion bar.
                <Card
                  key={site.slug}
                  className="h-full gap-0 py-0 transition-shadow hover:shadow-md"
                >
                  {/* ⚠️ `pb-3` OVERRIDES `p-5` AT THE BOTTOM ONLY, and it is
                      deliberate. MEASURED IN THE BROWSER 2026-08-31, not
                      guessed: every gap inside this card is CardContent's
                      `gap-3` = 12px, but the bottom padding was `p-5` = 20px, so
                      the card ended on a gap 8px wider than every other one.
                      That is what the user kept seeing as "the bottom is still
                      bigger" while I was wrongly adjusting the API row's own
                      padding, which was never the culprit.
                      `pb-3` puts the closing gap on the same 12px rhythm.
                      The TOP stays at 20px on purpose: the brand edge sits above
                      it, so it is not the same kind of boundary. */}
                  <CardContent className="flex h-full flex-col gap-3 p-5 pb-3">
                    {/* Header: logo tile + website title/description on the
                    left, the "View list" button on the right.
                    ⭐ PICKED FROM ALPHA (2026-08-29): the tile + text block.

                    ⚠️ THE "View list" BUTTON HAS MOVED TWICE. It began at the
                    right of this row, was removed 2026-08-29 as a duplicate of
                    the footer strip's copy, and the user moved it BACK here on
                    2026-08-31 ("Move the View list button to the empty space i
                    just marked") at DOUBLE the text size. It is not a duplicate
                    now: the strip kept Error History and gave this one up, so
                    each destination still appears exactly once on the card.

                    min-w-0 is what lets the description TRUNCATE instead of
                    widening the row: a flex item defaults to min-width:auto and
                    refuses to shrink below its content. Needed on BOTH the
                    wrapper below and the text block inside it, and it matters
                    more now that something sits to their right again. */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* ⭐ The logo TILE: a rounded square washed in the website's
                        own colour at 12% alpha (the `1F` alpha suffix on the hex),
                        holding a 24px glyph. Replaces the bare 32px icon that sat
                        next to the title. Monochrome SVG glyphs are still tinted
                        via a CSS mask; full-colour icons (the GHL favicon) still
                        render as a plain image. */}
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
                        {/* ⭐ The TEXT treatment: name and description stack BESIDE
                        the tile instead of under the icon row, the name drops
                        from text-xl to the heading face at text-base, and the
                        description drops to a truncated text-xs in a lighter
                        grey. Quieter, so the numbers below lead the card. */}
                        <div className="min-w-0">
                          <h3 className="font-heading text-base font-semibold text-zinc-900">
                            {site.label}
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {site.description}
                          </p>
                        </div>
                      </div>
                      {/* ⚠️ THE SIZE CAME FULL CIRCLE ON 2026-08-31. It went
                          `text-xs` -> `text-2xl` ("Double the text size") ->
                          `text-xl` ("a bit too large now") -> back to
                          `text-xs` ("try returning the size to the original").
                          It is 12px again, byte-for-byte the styling the button
                          wore in the footer strip, chevron and padding included.
                          WHAT DID CHANGE AND STUCK is the POSITION: this button
                          lives in the card header now, not the strip.
                          ⚠️ Do not re-enlarge it "to match its prominence". The
                          user tried 24px and 20px on production and came back to
                          12px both times; the enlargement is the part that was
                          rejected, not the move. */}
                      <Link
                        href={`/automations/${site.slug}`}
                        className="flex shrink-0 items-center gap-0.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-800 ring-1 ring-foreground/10 hover:bg-zinc-50"
                      >
                        View list
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* ⚠️ AN ENTIRE ROW USED TO SIT HERE and it is gone on purpose,
                    piece by piece, over 2026-08-29:
                      - the "Days since last Error" line, redundant once the
                        error panel below landed: the panel states the same fact
                        as "last Nd ago" / "not tracked yet", on the same row as
                        the count it belongs to.
                      - the outlined "Error History" button, once the footer
                        strip's own Error History button took over.
                      - the "Auto-refresh: ✓/✗" stat, once the strip's
                        "Auto-refresh on/off" made it a second copy. That was
                        the last thing in the row, so the row went with it, and
                        `AutoRefreshStat` is no longer imported here at all.
                    Do not put any of them back. No divider was added to replace
                    the row: the header flows straight into the counts block,
                    and the error panel under that separates itself with its
                    grey ground. */}

                    {/* ⭐ PICKED FROM ALPHA (2026-08-29): the counts block, in
                    place of the Total / Active / Paused column grid.
                    User: "Replace the existing statistic with this."
                    THE POINT OF IT: the total leads at 3xl and the split is a
                    PROPORTION rather than two more equal-weight numbers, so the
                    card answers "how big is this website" first and "how much of
                    it is running" second. The old grid gave all three the same
                    size, which made the total compete with its own parts.
                    ⚠️ The `Stat` helper went with the grid; it had no other
                    caller. And no `border-t` on either this or the error panel
                    below, matching Alpha: the panel separates itself with its
                    grey ground, and the strip further down brings its own. */}
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-heading text-3xl font-semibold leading-none tabular-nums text-zinc-900">
                            {stats.total}
                          </span>
                          <span className="text-xs text-zinc-500">
                            automations
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-600">
                          <span className="flex items-center gap-1.5">
                            {/* Active takes the website's own brand colour, so
                                the dot, the bar below and the card's top edge
                                are all the same colour on a given card. */}
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
                      {/* The split as one bar. Widths are percentages of the
                          site's own total, so the bar always fills; a website
                          with 0 automations leaves it empty grey, which is the
                          honest picture. */}
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

                    {/* ⭐ PICKED FROM ALPHA (2026-08-29): the error panel. One
                    grey block carrying the whole error story: the lifetime
                    count, how long ago the last one was, and a 30-day bar chart.
                    THE POINT OF IT: a big number that stopped growing reads
                    completely differently from a big number that is still
                    growing, and the old bare "Errors" stat could not tell the
                    two apart. n8n's 585 with bars every day and Make's 35 with
                    a flat month look identical as figures alone.
                    ⚠️ IT LANDED ABOVE THE COUNTS and the user swapped the two
                    the same day ("switch the position of these two elements"),
                    which also puts them in Alpha's own order. The size of the
                    website reads first, its error history second. Do not
                    reorder them again without asking. */}
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
                        {/* User-set wording, 2026-08-31: "Last Error X days
                            ago", replacing Alpha's terse "last Xd ago".
                            ⚠️ TWO CASES THEY DID NOT SPELL OUT, both handled to
                            keep the sentence grammatical, both easy to overrule:
                              - 1  -> "1 day ago", not "1 days ago". Same
                                singular rule they set on the amber cell counts.
                              - 0  -> "today". `getDaysSinceLastErrorByPlatform`
                                FLOORS the day count, so an error a few hours old
                                really does come back as 0, and "0 days ago"
                                would be on screen the moment Make or n8n errors.
                            "not tracked yet" is unchanged: absent from the map
                            means the platform has captured nothing ever, which
                            is permanent for GHL, GHL b2b and Zapier. */}
                        <span className="text-[11px] text-zinc-500">
                          {daysSinceError === undefined
                            ? "not tracked yet"
                            : daysSinceError === 0
                              ? "Last Error today"
                              : `Last Error ${daysSinceError} day${
                                  daysSinceError === 1 ? "" : "s"
                                } ago`}
                        </span>
                      </div>
                      <Sparkline dayKeys={dayKeys} counts={trend} />
                    </div>

                    {/* ⭐ PICKED FROM ALPHA (2026-08-29): the footer strip. A muted
                    band carrying the two state lines and the two per-website
                    destinations on ONE row, where each used to take a full
                    labelled row. Placed between the counts row and the API
                    status button at the user's direction ("place it above the
                    API status button and below the statistic i encircled").
                    "Last run" is NEW INFORMATION: neither Official nor Beta
                    said anything about how recently a website last did work.

                    ⚠️ TWO DIFFERENCES FROM ALPHA, both because Beta actually
                    works while Alpha is a static mock-up:
                      1. "Errors" and "View list" are real <Link>s here, not
                         decorative spans.
                      2. `-mx-5` bleeds the band to the card's edges, since it
                         sits INSIDE CardContent's p-5 rather than being a
                         sibling of the padded div as it is on Alpha. The
                         matching `px-5` keeps its text on the same left edge as
                         everything above it. */}
                    {/* ⚠️ `pt-3 pb-0`, NOT Alpha's `py-2.5`, and the asymmetry
                        is the whole point. MEASURED IN THE BROWSER 2026-08-31.
                        This band's background is `bg-muted/40`, 40% alpha on a
                        near-white, so it is INVISIBLE. Its `border-t` is not.
                        So the band's TOP padding is bounded by a visible line
                        and reads as a normal gap, while its BOTTOM padding has
                        no terminating edge and merges with CardContent's 12px
                        `gap-3` into ONE unbroken 22px band of white. That is the
                        "middle space is still twice" the user reported, and it
                        is why nothing I changed on the API row ever fixed it.
                        `pb-0` hands the whole bottom gap to `gap-3`; `pt-3`
                        matches it at 12px. Measured after: 12 / 13 / 12 / 12.
                        ⚠️ If this band ever gets a VISIBLE background, put
                        `py-2.5` back: the reasoning above stops holding. */}
                    <div className="-mx-5 flex items-center justify-between gap-3 border-t bg-muted/40 px-5 pt-3 pb-0">
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
                          Last run{" "}
                          {agoLabel(lastRunByPlatform[site.slug] ?? null)}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {/* ⚠️ Alpha had this as a quiet grey text link labelled
                        "Errors", a weaker sibling of the View list button. The
                        user promoted it 2026-08-29 ("This should be an 'Error
                        History' button") when the old outlined button was
                        removed and this became the ONLY way to that page from
                        the card. Styling and chevron are mirrored from the View
                        list button beside it, since both are plain navigation
                        and a half-matching pair would read as an oversight. */}
                        <Link
                          href={`/automations/${site.slug}/errors`}
                          className="flex items-center gap-0.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-800 ring-1 ring-foreground/10 hover:bg-zinc-50"
                        >
                          Error History
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                        {/* ⚠️ "View list" USED TO SIT HERE, beside Error History.
                        It moved into the card header on 2026-08-31 at the user's
                        request, so this side of the strip holds one button now.
                        Do not add a second copy back. */}
                      </div>
                    </div>

                    {/* Status button row. The API status button (flex-1) fills
                    the full card width.
                    ⚠️ NO `border-t`. It had one, and the user had it removed
                    2026-08-29 ("Remove This Divider Line"): the footer strip
                    directly above already ends the card's body with its own top
                    border and grey ground, so a second rule 12px under it was
                    drawing the same boundary twice.

                    ⚠️⚠️ NO TOP PADDING AT ALL, and that is the point. This row
                    had `pt-3`, then `pt-2`, and the user still read the gap as
                    too big: "the space is getting padded by both the element
                    above and below it. Remove the padding space above 'API key
                    integrated' so the only empty space is from the View list
                    row." So the ONLY thing separating this from the strip is now
                    CardContent's own `gap-3`, 12px. Do not add padding back.

                    ⚠️ `mt-auto` can still open a gap here that no padding change
                    will close. Cards in a grid row are stretched to the tallest
                    one, and `mt-auto` parks the slack directly ABOVE this row so
                    the buttons stay aligned across the row. If this gap ever
                    looks wrong on SOME cards and right on others, that is the
                    cause, and the fix is whatever made one card taller, not this
                    class. */}
                    <div className="mt-auto flex items-center gap-2">
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
      </TooltipProvider>
    </div>
  );
}

/** ⭐ PICKED FROM ALPHA: "14h ago" / "3d ago" / "never" for the footer strip's
 *  Last run line. Copied verbatim.
 *
 *  ⚠️ Reads `Date.now()` at RENDER time, which is fine only because this page is
 *  `dynamic = "force-dynamic"`: every request re-renders on the server, so the
 *  label cannot go stale in a cache. It does NOT tick while the page sits open,
 *  which is the same behaviour Alpha has. */
function agoLabel(date: Date | null): string {
  if (!date) return "never";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** ⭐ PICKED FROM ALPHA: the error bar chart under each card's count. Copied
 *  verbatim from `automations-alpha/page.tsx`; only the WINDOW differs, and it
 *  is not set here (see TREND_DAYS, widened to 30 at the user's request).
 *
 *  `dayKeys` comes in already built for the whole window, so a day with no
 *  errors still gets a bar (a flat 3px grey stub) instead of being skipped.
 *  That is what makes the five charts comparable: they share one x-axis, and a
 *  gap in the data reads as a quiet day rather than as missing time.
 *
 *  Heights are relative to THIS card's own max, not a global one. A card with a
 *  single error still shows a readable bar, at the cost of the five charts not
 *  being comparable by height. Deliberate: the shape of one website's month is
 *  the question here, and the raw count sits right above it. */
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

// NOTE: the `Stat` helper (a number over a small uppercase label) used to live
// here. It powered the Total / Active / Paused column grid, and went with it on
// 2026-08-29 when the Alpha counts block replaced that grid. It had no other
// caller. Official still has its own copy; this one is not coming back.
