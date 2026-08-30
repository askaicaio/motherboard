// Automations "Beta" hub, route /automations-beta.
//
// STARTED 2026-08-29 as a byte-for-byte copy of
// `src/app/(dashboard)/automations/page.tsx`, at the user's instruction ("an exact
// mirror that we can test"), so the bench began from something that already looked
// and behaved exactly like the live hub rather than from an empty page.
//
// It is NO LONGER a mirror: the card has been rebuilt element by element out of
// the Alpha versions, listed below. Everything still WORKS, which is the part that
// has not changed and the part that separates this page from the Alphas.
//
// ⭐ WHAT HAS BEEN PICKED SO FAR. Every element taken out of an Alpha is marked
// with a ⭐ comment at its site; this is the index. KEEP IT CURRENT, so the drift
// from Official stays readable at a glance.
//
// Housekeeping (not picked elements):
//   - this header comment, and the exported function's name.
//   - the black "Beta" pill next to the title. Added 2026-08-29 at the user's
//     request, because a page identical to the live hub gave you no way to tell
//     which one you were looking at ("so its at least somewhat distinguishable").
//     Markup copied from the Alpha pages, so all nine versions badge alike.
//
// Picked from ALPHA (`/automations-alpha`) on 2026-08-29, the user's words:
// "I like these icon style, text and the funny colored shadow behind the
// rectangle":
//   1. the BRAND EDGE, a 3px bar in the website's colour across the card's top
//      (their "funny colored shadow"). Brought the local ACCENT map with it.
//   2. the LOGO TILE, a rounded square washed in that colour at 12% alpha,
//      holding a 24px glyph, in place of the bare 32px icon.
//   3. the TEXT treatment, name and description stacked BESIDE the tile, the
//      name at the heading face and text-base, the description truncated at
//      text-xs in a lighter grey.
//   4. the ERROR PANEL: lifetime count + "last Nd ago" + a 14-day bar chart, in
//      one grey block. Brought the per-(platform, day) trend query and the
//      `Sparkline` component with it. User: "i like this error history graphic."
//   5. the FOOTER STRIP, between the counts row and the API status button:
//      auto-refresh state + "Last run Nh ago" on the left, Error History +
//      View list on the right, in one muted band. Brought the max(last_run_at)
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
// CARD ORDER, top to bottom, settled 2026-08-29: brand edge, header, COUNTS
// BLOCK, ERROR PANEL, footer strip, API status button. The counts and the panel
// landed the other way round and the user swapped them ("switch the position of
// these two elements"), which also matches Alpha's own order: how big the
// website is reads first, its error history second.
//
// ✅ THE DUPLICATES ARE RESOLVED. The card briefly said three things twice while
// the user compared both treatments on production; they then chose the STRIP's
// copy of every one ("alright, remove those two"). So each of these now appears
// EXACTLY ONCE, in the footer strip:
//   - auto-refresh state  (the "Auto-refresh: ✓/✗" row is gone, and with it the
//                          whole row it lived in)
//   - Error History       (the outlined button under the header is gone)
//   - View list           (the button at the right of the header row is gone)
// ⚠️ Do not reintroduce any of them elsewhere on the card.
//
// REMOVED as redundant once the error panel landed (the user asked for this in
// the same breath, "Remove redundant features after that"):
//   - the "Days since last Error" line. The panel says it as "last Nd ago" /
//     "not tracked yet", on the same row as the count it belongs to. Took the
//     `StatusMark` import with it.
//   - the "Errors" stat in the counts row, so that row is now THREE columns.
//     It was the same `errorCounts` figure the panel leads with.
//
// WHAT IT IS FOR: the redesign is NOT going to pick one winning Alpha. The user
// walks the Alpha versions one at a time and picks individual ELEMENTS out of
// each; the keepers get assembled HERE, on top of a working baseline, so a new
// element is judged next to the real thing rather than in isolation.
//
// ⚠️ WHY A COPY AND NOT A SHARED COMPONENT: extracting the hub into something
// both routes render would mean every Beta experiment could break the LIVE page.
// The whole version scheme exists so that cannot happen. Beta is allowed, and
// expected, to diverge. Same rule for the child components it imports: when an
// element changes, FORK that component rather than editing the shared one.
//
// ⚠️ THIS FILE WILL DRIFT FROM THE OFFICIAL PAGE, and that is the point. Do not
// "resync" it. If the Official page later gets a fix Beta should have too, port
// it deliberately.
//
// (Original header, kept because it still describes what the page does:)
// Automations Main Page, the hub. One card per automation website; each
// card shows a Total / Active / Paused stats row (counts from the
// automations table) and an "Open →" link to that website's page. The
// table / search / edit-mode features live on those per-website pages.

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

/** How many days of error history the per-card sparkline covers. Alpha's value,
 *  carried over with the element. The label under the bars reads off this, so
 *  changing the number keeps the caption honest by itself. */
const TREND_DAYS = 14;

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsBetaPage() {
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
                {/* Version badge. Copied EXACTLY from the Alpha pages' own badge
                (same rounded-full / bg-zinc-900 / 10px uppercase pill) so all
                nine versions mark themselves the same way. It exists because
                this page is otherwise indistinguishable from the live hub: the
                sidebar check mark was the only tell. */}
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Beta
                </span>
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
          the Dropdown Config page). All white (outline) with a leading icon. */}
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
              // This website's brand colour, for the top edge, the logo tile,
              // the "active" dot and the proportion bar.
              const accent = ACCENT[site.slug];
              return (
                // ⚠️ `gap-0 py-0` both override Card's own defaults, and BOTH are
                // needed. Card is `flex flex-col gap-4 ... py-4`, so with the brand
                // edge added as a second child it contributed TWO separate gaps
                // above the content: `py-4` above the edge, then `gap-4` between the
                // edge and CardContent. The first pass only killed `py-4`, which
                // left a 16px white band under the edge that the user flagged on
                // sight ("The cards have this large empty white space above").
                // With both at 0, CardContent's `p-5` supplies the entire inset, so
                // the top and bottom insets are equal at 20px.
                <Card
                  key={site.slug}
                  className="h-full gap-0 py-0 transition-shadow hover:shadow-md"
                >
                  {/* ⭐ PICKED FROM ALPHA (2026-08-29): the brand edge. A 3px bar in
                  the website's own colour across the top of the card, which the
                  user called "the funny colored shadow behind the rectangle".
                  It is the fastest way to tell the five cards apart at a glance.
                  Card already carries `overflow-hidden`, so the bar takes the
                  card's rounded top corners for free. */}
                  <div
                    aria-hidden
                    className="h-[3px] w-full shrink-0"
                    style={{ backgroundColor: accent }}
                  />
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
                    {/* Header: logo tile + website title/description, full width.
                    ⭐ PICKED FROM ALPHA (2026-08-29): the whole block.
                    ⚠️ A "View List" button used to sit at the right of this row.
                    REMOVED 2026-08-29 on the user's instruction, once the footer
                    strip's own "View list ›" made it a second copy of the same
                    link. Do not put it back. That is also why this is a plain
                    row now and no longer a `justify-between` flex.

                    min-w-0 is what lets the description TRUNCATE instead of
                    widening the row: a flex item defaults to min-width:auto and
                    refuses to shrink below its content. Still needed on BOTH
                    this wrapper and the text block inside it, even with nothing
                    to its right, because the card itself is a fixed grid cell. */}
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
                    count, how long ago the last one was, and a 14-day bar chart.
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
                        <span className="text-[11px] text-zinc-500">
                          {daysSinceError !== undefined
                            ? `last ${daysSinceError}d ago`
                            : "not tracked yet"}
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
                        <Link
                          href={`/automations/${site.slug}`}
                          className="flex items-center gap-0.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-800 ring-1 ring-foreground/10 hover:bg-zinc-50"
                        >
                          View list
                          <ChevronRight className="h-3 w-3" />
                        </Link>
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

/** ⭐ PICKED FROM ALPHA: the 14-day error bar chart under each card's count.
 *  Copied verbatim from `automations-alpha/page.tsx`.
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
