// Automations "Beta" hub, route /automations-beta.
//
// ⚠️ RIGHT NOW THIS IS AN EXACT MIRROR OF THE OFFICIAL PAGE, on purpose. Created
// 2026-08-29 as a byte-for-byte copy of `src/app/(dashboard)/automations/page.tsx`,
// so it looks AND behaves identically: same queries, same client components, same
// working controls, same links out to the real sub-pages. The user asked for "an
// exact mirror that we can test".
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
//   4. the ERROR PANEL, in the space under the Error History button: lifetime
//      count + "last Nd ago" + a 14-day bar chart, in one grey block. Brought
//      the per-(platform, day) trend query and the `Sparkline` component with
//      it. User: "i like this error history graphic."
//   5. the FOOTER STRIP, between the counts row and the API status button:
//      auto-refresh state + "Last run Nh ago" on the left, Error History +
//      View list on the right, in one muted band. Brought the max(last_run_at)
//      query and `agoLabel` with it. "Last run" is NEW INFORMATION, not a
//      restyle. User: "i like this lower widget."
//      - The strip's error link arrived from Alpha as a quiet grey "Errors"
//        text link. The user promoted it to a button labelled "Error History"
//        and had the old outlined button removed, so the strip is now the only
//        route to that page from the card.
//
// ⚠️ THE CARD STILL SAYS TWO THINGS TWICE, and the user chose to KEEP it that
// way for now ("Leave all three, decide later") so both treatments can be
// compared on production: AUTO-REFRESH STATE (the row under the header AND the
// strip) and VIEW LIST (top right AND the strip). This is a PENDING DECISION,
// not an oversight. Do not remove either unprompted.
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
import { AutoRefreshStat } from "@/components/automations/auto-refresh-stat";
// NOTE: StatusMark went with the "Days since last Error" line (2026-08-29). The
// error panel picked from Alpha carries that same fact as "last Nd ago" /
// "not tracked yet", so the red-X placeholder had nothing left to say.
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
            <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
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
          // This website's brand colour, for the top edge + the logo tile.
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
              <CardContent className="flex h-full flex-col gap-3 p-5">
                {/* Header: logo tile + website title/description on the left,
                    "View List" on the right. Still bottom-aligned, so the
                    button sits inline with the description line, which is now
                    the bottom line of the tile row rather than a line below it.
                    ⭐ PICKED FROM ALPHA (2026-08-29): the whole left block. */}
                <div className="flex items-end justify-between gap-2">
                  {/* min-w-0 is what lets the description TRUNCATE instead of
                      widening the row: a flex item defaults to min-width:auto
                      and refuses to shrink below its content. Needed on this
                      wrapper AND on the text block inside it. */}
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
                  {/* View List: opens this website's per-website page.
                      Bottom-right, inline with the description line. */}
                  <Link
                    href={`/automations/${site.slug}`}
                    className="shrink-0 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    View List
                  </Link>
                </div>

                {/* Auto-refresh state. TWO THINGS HAVE BEEN REMOVED from this
                    row, both deliberate, neither an oversight:
                      - the "Days since last Error" line (2026-08-29), redundant
                        once the error panel below landed: the panel states the
                        same fact as "last Nd ago" / "not tracked yet", on the
                        same row as the count it belongs to.
                      - the outlined "Error History" button (2026-08-29), on the
                        user's instruction after the footer strip's own Error
                        History button took over ("afterwards, remove the old
                        button").
                    Do not put either back. */}
                <div className="border-t pt-3">
                  {/* Auto-refresh on/off state (green check / red X). Reads
                      the same stored state the per-website toggle writes;
                      display-only here. ⚠️ The footer strip ALSO reports this,
                      as "Auto-refresh on/off". The user is keeping both for now
                      to compare the two treatments; see the header comment. */}
                  <AutoRefreshStat
                    enabled={autoRefreshMap[site.slug]?.enabled ?? false}
                  />
                </div>

                {/* ⭐ PICKED FROM ALPHA (2026-08-29): the error panel, placed in
                    the space under the Error History button at the user's
                    direction. One grey block carrying the whole error story:
                    the lifetime count, how long ago the last one was, and a
                    14-day bar chart.
                    THE POINT OF IT: a big number that stopped growing reads
                    completely differently from a big number that is still
                    growing, and the old bare "Errors" stat could not tell the
                    two apart. n8n's 585 with bars every day and Make's 35 with
                    a flat month look identical as figures alone. */}
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

                {/* ⚠️ THREE columns, not four. The "Errors" stat was REMOVED
                    2026-08-29 when the panel above landed: it showed the same
                    `errorCounts` figure, and the panel says it better (coloured
                    by whether there are any, with the trend under it). */}
                <div className="grid grid-cols-3 gap-2 border-t pt-3">
                  <Stat label="Total" value={stats.total} />
                  <Stat
                    label="Active"
                    value={stats.active}
                    valueClassName="text-green-600"
                  />
                  <Stat label="Paused" value={stats.paused} />
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
                <div className="-mx-5 flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-2.5">
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
