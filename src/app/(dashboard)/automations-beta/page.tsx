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
import { buttonVariants } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/automations/tooltips";
import { CopyApiKeyButton } from "@/components/automations/copy-api-key-button";
import { CardNavIndicator } from "./nav-indicator";
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

  // Shared by the trend query below and by nothing else; hoisted only because
  // that query now lives inside a `Promise.all` array.
  const dayExpr = sql`to_char(${automationErrors.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`;

  // -------------------------------------------------------------------------
  // ⚡⚡ ALL EIGHT READS RUN IN PARALLEL, AND THAT IS LOAD-BEARING, NOT TIDINESS.
  //
  // They were eight sequential `await`s until 2026-09-06, which meant the page
  // paid EIGHT round trips to Supabase end to end instead of one. The user
  // reported it as the symptom: "there is around a 1 second delay before this
  // section of the page changes" after clicking a website in the rail.
  //
  // MEASURED, against the real database with every pool connection already
  // warm, so this is query latency and not connection setup:
  //     sequential   3058 ms
  //     Promise.all   498 ms      <- the slowest SINGLE query, as expected
  //     saved        2560 ms (84%)
  // (Those absolute numbers are from a developer machine, which is much
  // further from Supabase than Vercel is. THE RATIO is the part that carries
  // over: this page waits for the slowest query instead of the sum of all of
  // them.)
  //
  // ⚠️ NOTHING HERE DEPENDS ON ANYTHING ELSE HERE. Every one of the eight is
  // independent; `selected` is resolved from `searchParams` above, before this
  // runs. **If you add a read that DOES depend on another, do not thread it
  // through this array** - run it after, or the dependency silently becomes a
  // race.
  // ⚠️ `requireAuth()` stays OUTSIDE and BEFORE this on purpose. It is also a
  // query, but folding it in would run all eight of these for a signed-out
  // visitor before the guard could redirect.
  // 📌 SIX OF THE EIGHT RETURN THE SAME DATA FOR EVERY WEBSITE. Only
  // `siteErrors` and `recentlyEdited` read `selected.slug`, so a site switch
  // re-runs six queries whose answers cannot have changed. Parallelising makes
  // that cost one round trip instead of six; removing it entirely means
  // fetching those two for all five sites and switching on the client. That is
  // a separate, larger change and it was NOT done here.
  // -------------------------------------------------------------------------
  const [
    // Last stored Auto-API health check results + the toggle's state. Needed
    // because this page's health controls are REAL, unlike Alpha3's static pill.
    health,
    autoRefreshMap,
    errorCounts,
    daysSinceErrorByPlatform,
    grouped,
    siteErrors,
    trendRows,
    recentlyEdited,
  ] = await Promise.all([
    getHealthState(),
    getAutoRefreshMap(),
    getErrorCountsByPlatform(),
    getDaysSinceLastErrorByPlatform(),
    db
      .select({
        platform: automations.platform,
        status: automations.status,
        count: sql<number>`count(*)::int`,
      })
      .from(automations)
      .groupBy(automations.platform, automations.status),
    // The selected website's newest errors, WITH the message text. The card
    // layouts have room for a count and nothing else, which is the whole reason
    // this design exists.
    db
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
      .limit(PANEL_ROWS),
    // Error counts per (platform, UTC day) over the trend window, for the error
    // panel's bar chart. Came back with the live hub's statistics on 2026-09-03.
    // ⚠️ Grouped by platform for ALL sites even though only the selected one is
    // drawn, because that is the shape `Sparkline` takes and it costs the same
    // single aggregate either way. Platforms with no capture come back empty and
    // draw a flat baseline, which is the correct picture: GHL, GHL b2b and Zapier
    // cannot capture errors at all.
    db
      .select({
        platform: automationErrors.platform,
        day: sql<string>`${dayExpr}`,
        count: sql<number>`count(*)::int`,
      })
      .from(automationErrors)
      .where(
        sql`${automationErrors.occurredAt} >= now() - make_interval(days => ${TREND_DAYS - 1})`,
      )
      .groupBy(automationErrors.platform, dayExpr),
    // What was edited most recently ON THE SOURCE WEBSITE (the synced
    // `last_edited_at`, NOT our own Row Update). No hub surface shows this today,
    // and it is the closest thing to "what is someone actually working on".
    db
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
      .limit(PANEL_ROWS),
  ]);

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

  // ⚠️ `portfolioTotal` (the estate-wide sum) and `connected` (how many of
  // the five have an API key) were computed here for the rail's "Sources"
  // header. Both went with it on 2026-09-06; see the note where that header
  // was. Nothing else read either one.

  // Everything the detail panel needs about the selected website.
  // NOTE: `stats` (this site's total/active/paused) and the `activePct` /
  // `pausedPct` pair were read here for the panel's counts block. All three
  // went with it on 2026-09-03; see the note at the top of the panel body.
  // `statsByPlatform` itself stays, because the RAIL ROWS read it. (It was
  // also feeding `portfolioTotal` until the "Sources" header was removed on
  // 2026-09-06, so the rail rows are now its only consumer.)
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

          {/* ⭐⭐ TOOLBAR STRIP, 2026-09-06: "Remove this toolbar. Use S2 as a
              reference and add the old toolbar back to the beta page." S1 was
              this page's own rail Tools list, S2 was the LIVE hub's strip.
              ⚠️⚠️ THIS IS A DELIBERATE COPY OF THE LIVE HUB'S MARKUP, NOT A
              SHARED COMPONENT, and it must stay a copy. `/automations` and
              `/automations-beta` are independent files ON PURPOSE so the bench
              can never break the live page; factoring these three links into a
              shared component would undo that. If the live strip changes and
              this should follow, copy it again by hand.
              ⚠️ WHAT IT REPLACED: a vertical **Tools** list pinned under the
              rail's cards (`RailTool`, a label row plus three chevroned rows).
              That existed because the rail layout had no toolbar of its own;
              the note on it read "these three are the only route to those pages
              from this page". They still are, they are just up here now, so
              **do not re-add the rail section as well** and leave the estate
              with two copies.
              📌 HISTORY THAT CUTS THE OTHER WAY, worth knowing before anyone
              "improves" this: the LIVE page once tried the opposite swap. PR
              #427 (2026-08-31) replaced this strip with Alpha's Tools CARD and
              the user reverted it the same day ("lets roll back the previous
              change, it doesnt look good right now"). **So the strip has now
              won on both pages, in both directions.** Treat it as settled.
              ⚠️ Same three destinations, same order, same icons as the live
              hub: Feature Integration (Plug), View All Lists (List), Dropdown
              Configuration (ListChecks). `rounded-xl bg-card ring-1
              ring-foreground/10` matches the pane below it, exactly as the
              live strip matches its cards. */}
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

          {/* One pane, split. The rail is the master list, the panel is the
              detail view. Both scroll inside the pane rather than the page, so
              the split never comes apart as the detail content grows. */}
          {/* ⚠️ `group/pane` IS FUNCTIONAL, not a stray utility. The detail
              panel dims while a rail navigation is in flight, and it reaches the
              pending flag with `group-has-[[data-pending]]/pane:`. The flag is
              set by `CardNavIndicator` inside a rail card, which is a COUSIN of
              the panel, so a `group` on their common ancestor is what connects
              them. Drop this class and the panel stops dimming, with no error. */}
          <div className="group/pane flex min-h-[640px] overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {/* ---- Rail. Every website, always visible, so switching costs one
                    click and you never lose your bearings. ---- */}
            {/* ⚠️ w-[460px], AND THE 60 IS NOT ROUND BY ACCIDENT. It is the
                    narrowest ten-pixel step that still fits every site name.
                    WIDENED FIVE TIMES FROM Alpha3's w-64 AND THEN TRIMMED FOUR
                    TIMES: w-80, then 416px on 2026-09-03, then 448px, 672px and
                    640px on 2026-09-04, then 600px, 500px and 460px on
                    2026-09-06.
                    ⚠️ THE FIRST THREE TRIMS ARE ROUND-NUMBER PREFERENCES, not
                    fixes ("make the 672px into 640px", "now pls make it 600px",
                    "Pls make that 600 into 500 now"). Nothing needed the width
                    back, so do not go looking for a functional reason.
                    🛑🛑 THE FOURTH IS DIFFERENT AND THIS IS THE ONE TO READ
                    BEFORE TOUCHING THIS NUMBER. The user asked for **450**
                    ("change the 500 to 450 now"). 450 is 3px UNDER the measured
                    453px content floor (449 since the logo moved into the
                    title row on 2026-09-06), and it made the Zapier card render
                    **"Zap…"** instead of "Zapier". That was measured, put to
                    the user with the cost spelled out, and **they chose 460
                    instead**, which is the nearest width that fits.
                    ⚠️ WHY THREE CHARACTERS WENT FOR A 3.7px SHORTFALL, since it
                    is the reason 450 was not worth it: the ellipsis glyph is
                    12.7px on its own at this font (500 14px Inter) and it has
                    to fit INSIDE the space available, so it evicts far more
                    than it saves. **A name here is either fully visible or
                    badly cut; there is no gentle degradation.** Never assume a
                    few pixels under the floor costs a few pixels of text.
                    ⚠️ IF THIS EVER HAS TO GO BELOW THE FLOOR, take the pixels off the
                    TITLE LINE rather than accepting the clip: the row's
                    `gap-1.5` (6px, twice) and the "Auto-refresh off" label are
                    the candidates. Do not touch the name's `truncate` /
                    `min-w-0`: removing those overflows the card instead of
                    clipping the text, which is worse.
                    ⚠️⚠️ THE LAST FIVE STEPS ARE THE ONLY ONES NOT DRIVEN BY
                    CONTENT. Every earlier widening was the minimum some element
                    needed. 672 was a proportion the user asked for outright:
                    "Make this section wider, you can decrease the width of the
                    stuff on the right side to accomodate it. Make the left side
                    roughly x1.5 times as wide." 448 x 1.5 = 672 exactly.
                    ⚠️ THE RAIL IS ALSO BELOW THE 571px "FLOOR" AN EARLIER
                    VERSION OF THIS NOTE GAVE, and THAT part is not a bug at
                    all. 571 was real, but it was measured while the title row
                    carried the 225px Error History + View list PAIR. #467 moved
                    Error History to the detail header, the row's buttons went
                    from 225px to 107px, and the floor fell to 453 with them
                    (then to 449 when the logo joined that row on 2026-09-06).
                    📌 THE GENERAL POINT, since this note has now been wrong
                    TWICE (448 was stale the same way): **a measured width note
                    goes stale the moment anything on the row it measured
                    changes.** Check what a number was measured against before
                    reusing it.
                    ⚠️ MEASURED IN THE BROWSER on 2026-09-06, BEFORE shipping
                    each step, with this exact markup and the live figures:
                      **THE FLOOR IS 449px.** 460 is ELEVEN PIXELS ABOVE IT.
                      **AT 460 every card is 443px wide with a 408px content
                      column, all five are 120px tall, and NOTHING truncates.**
                      Title-line slack, per card:
                        Zapier   +11px   <- the whole margin
                        GHL b2b  +33px
                        Make     +54px
                        GHL      +62px
                        n8n      +63px
                      Zapier is worst because it uniquely carries BOTH the
                      longest status label ("Not connected") AND the longer
                      "Auto-refresh off".
                      ⚠️ RE-MEASURED 2026-09-06 AFTER THE LOGO MOVED INTO THE
                      TITLE ROW, and it moved BOTH numbers in our favour: the
                      floor went 453 -> 449 and Zapier's slack 7px -> 11px.
                      **The logo did not get cheaper, the GAP did**: as a
                      sibling of the content column it sat behind the card's
                      `gap-2.5` (10px); inside the title row it sits behind
                      `gap-1.5` (6px). The content column also gained the 30px
                      the logo's old column was reserving, 378 -> 408.
                      STAT LINE needs 228px worst case against the full 408px
                      column, so 180px spare. The API bar is a full-width
                      sibling too. NEITHER is close to binding, at any width
                      this rail has had.
                    ⚠️ SO THE TITLE LINE IS THE BINDING CONSTRAINT AND ZAPIER IS
                    THE WORST CASE. The site NAME is what clips, because the
                    pill and the refresh label are both `shrink-0` and only the
                    name has `min-w-0` + `truncate`. That ordering is
                    deliberate; see the title line's own note.
                    ⚠️ HISTORY, so the earlier reason does not read as stale:
                    the w-80 step existed only so the action buttons could be
                    square at the card's height, and the user narrowed those
                    buttons back to 32px the same day. I offered to hand that
                    64px back and they chose to keep the roomier cards. So
                    neither step is a leftover; do not "restore" w-64. */}
            <div className="flex w-[460px] shrink-0 flex-col border-r">
              {/* ⚠️⚠️ THE RAIL'S "Sources" HEADER WAS HERE and was removed on
                  2026-09-06 ("Remove this section"). It was a title row plus a
                  one-line ESTATE AGGREGATE: "{total} automations, {n} of 5
                  connected".
                  **THAT AGGREGATE NOW EXISTS NOWHERE ON THIS PAGE, and nowhere
                  on the live hub either** (checked: `/automations` never had
                  it; only Alpha3 and Alpha4 still carry a copy). Its old note
                  claimed it was there so "nothing is actually lost" when the
                  detail panel's counts block went on 2026-09-03. That is no
                  longer true, and the loss was pointed out before removing it.
                  **So if a portfolio total is ever wanted back, it is a NEW
                  element, not a restore**, and `portfolioTotal` / `connected`
                  went with this block.
                  ⚠️ The rail now opens straight onto its cards. `nav` keeps its
                  `p-2`, so they still clear the pane's rounded corner, and the
                  `border-b` that separated header from list went with the
                  header rather than being left as a stray rule. */}
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
                      {/* ⚠️ THIS LINK HAS A CHILD NOW, and it is not
                          decoration: `CardNavIndicator` calls `useLinkStatus`,
                          which reports the pending state of its NEAREST
                          ANCESTOR Link. Move it out of here and it reports
                          `pending: false` forever and silently does nothing.
                          See its own file for why the feedback exists. */}
                      {/* ⚡⚡ `prefetch` IS THE WHOLE SPEED FIX, 2026-09-06, and
                          it is one prop where a client-side rewrite was the
                          alternative. READ THIS BEFORE REMOVING IT.
                          The user asked for an instant switch after #470 (eight
                          reads in parallel) and #471 (instant click feedback)
                          left a real wait underneath. The plan was to fetch all
                          five sites up front and switch on the client, moving
                          ~950 lines of rail and panel JSX into a client
                          component. The bundled Next docs made that
                          unnecessary:
                            - `prefetch` DEFAULT ("auto"/null) on a DYNAMIC
                              route prefetches only "the partial route down to
                              the nearest `loading.js` boundary". This page is
                              `force-dynamic` with NO loading.js, so the default
                              prefetches effectively nothing. That is why the
                              switch always cost a full round trip.
                            - `prefetch={true}` prefetches "the full route
                              **for both static and dynamic routes**".
                            - and the payload then falls under the CLIENT
                              CACHE's `static` stale time, NOT `dynamic`:
                              "The `static` property is used for statically
                              generated pages, **or when the `prefetch` prop on
                              Link is set to true**". Default 5 minutes.
                              `dynamic` defaults to 0s (never reused) since
                              v15, which is exactly why the default prefetch
                              would not have helped even if it had fetched.
                          All five cards are in the viewport at once, so all five
                          payloads land shortly after the page does and a click
                          is served from cache.
                          ⚠️⚠️ WHAT IT COSTS, so nobody discovers it as a
                          mystery: **a page load now triggers FIVE extra full
                          renders of this route in the background**, one per
                          card, each running the page's eight queries. Six
                          renders per view instead of one. That was judged fine
                          for an internal tool with a handful of users; it would
                          NOT be fine on a public page. If it ever needs
                          trimming, the documented pattern is hover-triggered
                          prefetch (`prefetch={active ? true : false}` with an
                          `onMouseEnter`), which costs one prefetch per hover.
                          ⚠️ AND WHAT IT TRADES: a switch can now show data up to
                          FIVE MINUTES old, where before every switch was a
                          fresh render. Acceptable here because the error data
                          behind this panel is refreshed by a 24h cron sweep,
                          not continuously, so five minutes is nothing against
                          its actual cadence. **If this page ever gains
                          second-by-second data, revisit this**, and see
                          `experimental.staleTimes` (global, so changing it
                          affects the whole app).
                          ⚠️ PREFETCHING ONLY RUNS IN PRODUCTION. It cannot be
                          tested with `next dev`, so do not conclude it is
                          broken from a local check.
                          ⚠️ #471'S FEEDBACK STAYS AND IS NOT REDUNDANT: it is
                          the fallback for a COLD cache (first click after load,
                          or after the 5 minutes lapse). When the cache is warm
                          the navigation finishes so fast the tint never
                          visibly appears, which is the point. */}
                      <Link
                        href={`/automations-beta?site=${site.slug}`}
                        aria-label={`Show ${site.label}`}
                        prefetch
                        className="absolute inset-0 rounded-lg"
                      >
                        <CardNavIndicator accent={ACCENT[site.slug]} />
                      </Link>
                      {/* ⭐ Accent spine: THE SELECTED CARD'S ONLY, as of
                          2026-09-07. "Right now Make is currently selected, so
                          its correct that it can be seen, but the others are
                          not selected, so their bar strip should be invisible."
                          ⚠️ IT WAS `0.35` ON THE UNSELECTED ROWS, not 0. The old
                          note called that "faint on the rest, so the current
                          website is obvious without a second indicator", which
                          was true when the rail had no other selection cue. It
                          has had `bg-zinc-100` on the selected card for days, so
                          the faint copies were adding noise rather than
                          information.
                          ⚠️⚠️ `opacity: 0` AND NOT A CONDITIONAL RENDER, ON
                          PURPOSE. The span still occupies its 3px plus the
                          card's `gap-2.5`, so **all five cards keep identical
                          internal alignment and nothing shifts when you change
                          selection.** Returning `null` for the unselected rows
                          would slide their whole content column 13px left and
                          make the rail jump on every click. Do not "simplify"
                          this into `{isCurrent && <span .../>}`.
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
                          opacity: isCurrent ? 1 : 0,
                        }}
                      />
                      {/* ⚠️⚠️ THE LOGO WAS A FLEX CHILD *HERE* until 2026-09-06
                          and it is now INSIDE THE TITLE ROW instead. "I noticed
                          these icons have their own dedicated column. lets not
                          do that. Move the icons to be inline with the website
                          name instead."
                          WHY IT READ AS A COLUMN: as a sibling of the content
                          column it reserved its own 20px + 10px gap for the
                          card's WHOLE height, so the statistic and the API bar
                          started 30px in, level with nothing. That is the same
                          shape of mistake as #465 (the button pair hung off the
                          whole column instead of the row it belonged to), and
                          the same fix: **an element that belongs beside ONE ROW
                          goes IN that row.**
                          ⚠️ THE CARD IS NOW SPINE + CONTENT COLUMN, two
                          children. Do not re-add a third here. */}
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
                            {/* ⭐ THE LOGO, INLINE WITH THE NAME as of
                                2026-09-06. It used to be a sibling of the whole
                                content column; see the note where it was.
                                ⚠️ NO `self-start` ANY MORE, and its old reason
                                is satisfied rather than ignored. That class
                                existed because "a vertically centred logo
                                floated beside the statistic instead of sitting
                                level with the name" - true when the logo spanned
                                the card's full height. This row is
                                `items-center`, so the logo now centres on the
                                NAME's line, which is exactly what that note
                                wanted. Re-adding `self-start` here would push it
                                against the row's top edge instead.
                                ⚠️ `shrink-0` is not passed because `SiteGlyph`
                                applies it internally; it must never shrink, so
                                the NAME still yields first. */}
                            <SiteGlyph site={site} className="h-5 w-5" />
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
                            {/* ⚠️⚠️ WHITE, NOT SOLID BLACK, as of 2026-09-07:
                                "Make these buttons white again."
                                ⚠️ "AGAIN" DOES NOT POINT AT A PREVIOUS STATE OF
                                THIS BUTTON. Checked the history: the rail's View
                                list has been `bg-zinc-900` since it was created
                                (#443, then #464). **The white button that used
                                to sit in this card was ERROR HISTORY**, which
                                left for the detail header in #467 and took the
                                card's only white control with it.
                                ⚠️ THIS IS ERROR HISTORY'S EXACT TREATMENT,
                                copied rather than approximated, and the detail
                                header's Error History Link still carries the
                                same string. Keep the two in step: if one is
                                restyled the other should follow, because they
                                are the same control class on two surfaces.
                                ⭐ THE BENCH AND THE LIVE HUB MATCH AGAIN. For
                                one PR they did not: #478 whitened this copy
                                only. Asked whether to accept that divergence or
                                close it, the user chose to close it, and the
                                live hub's View list was whitened to the same
                                string in the follow-up. **Both pages now carry
                                this exact class list, so keep them in step.**
                                🛑 AND BOTH HAVE GIVEN UP THE CARD'S
                                PRIMARY/SECONDARY HIERARCHY as a result. Dark
                                used to mean "the main way in"; now View list
                                and Error History are equal weight and position
                                alone signals which matters. **That was put to
                                the user in those words and accepted, so do not
                                "restore emphasis" by blackening either copy.**
                                📌 #461 promoted the BLACK treatment to
                                `/automations` so both surfaces would read
                                alike; this reverses the colour while keeping
                                that goal. */}
                            <Link
                              href={`/automations/${site.slug}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-card px-2.5 text-xs font-medium text-zinc-600 ring-1 ring-foreground/10 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
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

              {/* ⚠️ THE RAIL'S "Tools" SECTION WAS HERE and was removed on
                  2026-09-06 ("Remove this toolbar"). Its three links moved to
                  the horizontal strip above the pane, copied from the live hub.
                  The rail now ends with its cards. Do not put them back: the
                  destinations are not lost, they are just above. */}
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
            {/* ⚠️ THE DIM IS THE POINT OF THE WHOLE CHANGE: this panel is the
                "section of the page" the user said takes a second to change, so
                it has to acknowledge the click even though its data cannot
                arrive yet. 60% for the ~300ms a switch takes, eased, so it reads
                as "working" rather than as a flash.
                ⚠️ It depends on TWO things elsewhere: `group/pane` on the pane
                above, and the `data-pending` attribute inside
                `CardNavIndicator`. Both are silent if removed. */}
            <div className="@container min-w-0 flex-1 transition-opacity duration-200 group-has-[[data-pending]]/pane:opacity-60">
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
                      top-aligned with the `<h2>` to the pixel, until the row
                      wraps and the button drops to its own line, LEFT-aligned
                      under the description. It never overflows, which is the
                      whole point of `flex-wrap`. **The wrap point depends on
                      the DESCRIPTION's length: below a 472px panel for the
                      longest one ("Workflows found in GoHighLevel b2b"), below
                      392px for the shortest.**
                      ⚠️ PANEL WIDTH = VIEWPORT - 336px OF CHROME - THE RAIL,
                      and the 336 is 240 sidebar (`pl-60`) + the layout's
                      `p-6` + THIS PAGE'S OWN `p-6`. A real scrollbar takes
                      ~15px more. **The doubled p-6 is the part that is easy to
                      miss: an earlier version of this note derived 288 and was
                      wrong at every viewport.** MEASURED with the rail at 460,
                      by rebuilding that chrome around the pane:
                        1920 -> 1124px panel. No wrap. Two-column lists.
                        1440 ->  644px panel. No wrap. **Two-column lists**, by
                                 FOUR PIXELS over the `@min-[640px]` container
                                 query.
                        1280 ->  484px panel. **No wrap at all**, by 12px over
                                 the 472px threshold.
                      ⭐⭐ SO THE RAIL TRIMS FIXED THE PANEL, AND 460 IS THE
                      WIDTH WHERE BOTH COME GOOD. The progression is worth
                      keeping because it shows how narrow the margins are:
                        rail 600 -> 1280 panel 344px, EVERY description wrapped.
                        rail 500 -> 1280 panel 444px, only the longest wrapped;
                                    1440 panel 604px, lists still stacked.
                        rail 460 -> 1280 panel 484px, nothing wraps; 1440 panel
                                    644px, lists go side by side.
                      🛑 **THE 1440 TWO-COLUMN LAYOUT SURVIVES BY 4px. WIDEN
                      THIS RAIL AT ALL AND IT IS GONE**, and the failure is
                      silent: the lists simply stack and nobody connects it to a
                      rail change. The 1280 wrap has 12px. **Re-measure before
                      assuming any widening is free.**
                      ⚠️ THE RAIL IS SQUEEZED FROM BOTH SIDES NOW, which is new:
                      the cards want >= 449 and the panel wants <= 460. That is
                      an ELEVEN PIXEL WINDOW, so this number is no longer a free
                      choice. Anything outside it costs something measurable.
                      Do not "fix" a wrap with `whitespace-nowrap` or a fixed
                      width: those trade a graceful wrap for a crushed name. */}
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
                {/* ⭐⭐ EVERY ROW IN BOTH LISTS IS A LINK, 2026-09-06: "make it
                    so that clicking an entry on these leads to their respective
                    per website page with the search filled in with exactly the
                    automation's name."
                    ⚠️ THE `?q=` CONTRACT IS THE WHOLE MECHANISM AND IT ALREADY
                    EXISTED: `/automations/[platform]` reads `?q=` ON THE SERVER
                    and hands it to the table as `initialQuery`, which seeds the
                    search box. **So this needed no change to the live page at
                    all.** If that param is ever renamed, these two links break
                    SILENTLY: they will still navigate, the search box will just
                    be empty.
                    ⚠️ `encodeURIComponent` is not optional. Automation names in
                    this estate contain spaces, parentheses and `->` ("New Zoom
                    meeting -> G-Drive", "Mary the scheduler ( Slots)"), and an
                    unencoded `&` or `#` would truncate the query.
                    ⚠️ THE PADDING MOVED FROM THE `<li>` ONTO THE `<Link>`, so
                    the whole row is the hit target rather than just its text.
                    Putting it back on the `<li>` leaves a dead border around a
                    clickable middle.
                    ⚠️ SAFE TO WRAP because neither row contains an interactive
                    element: they are spans, a `<p>` and an icon. **If a control
                    is ever added to a row, this Link has to become an overlay
                    instead** (`relative` row + `absolute inset-0` Link +
                    `relative z-10` on the control), the same shape the rail
                    cards use, because an `<a>` may not contain a button or
                    another anchor. */}
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
                      <li key={row.id}>
                        <Link
                          href={`/automations/${selected.slug}?q=${encodeURIComponent(row.name)}`}
                          className="block px-3.5 py-2.5 transition-colors hover:bg-zinc-50"
                        >
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
                        </Link>
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
                      <li key={row.id}>
                        <Link
                          href={`/automations/${selected.slug}?q=${encodeURIComponent(row.name)}`}
                          className="block px-3.5 py-2.5 transition-colors hover:bg-zinc-50"
                        >
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
                        </Link>
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
// Pieces. All copied from Alpha3. (RailTool was the one exception, a real
// link where Alpha3 has a decorative span; it went with the rail Tools section
// on 2026-09-06 and its note sits further down.)
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

/* ⚠️ `RailTool` LIVED HERE and went with the rail's Tools section on
    2026-09-06. It was the one piece this page did NOT copy from Alpha3
    unchanged: Alpha3 renders those rows as decorative <span>s and this page
    made them real <Link>s. Nothing renders them any more, so the component
    went too rather than sitting unused. The live hub's toolbar strip above the
    pane is what replaced it. */

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
