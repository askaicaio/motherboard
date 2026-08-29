// =============================================================
// Automations ALPHA5 - a work queue
// =============================================================
// The sixth presentation of the Automations hub.
//
// PREMISE: every other layout, this one's four predecessors included, shows
// you STATE and leaves the conclusion to you. 899 tracked, 614 errors, a red
// X on three cards: all true, and all of it still needs a human to work out
// what to actually DO. This layout does that step itself. It shows nothing but
// open work, ranked, with the reason each item matters. When there is no open
// work it says so and shows an empty page, which is the strongest thing a
// dashboard can ever tell you.
//
// It is also the only layout that surfaces INVENTORY QUALITY (rows with no
// Purpose, no Notes, active rows that have not run in 90 days) as work rather
// than as a column you would have to go and read.
//
// Real data, static controls.
// =============================================================

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  KeyRound,
  List,
  ListChecks,
  Plug,
  RefreshCw,
  StickyNote,
  Target,
} from "lucide-react";
import { sql } from "drizzle-orm";

import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automationErrors, automations } from "@/lib/db/schema";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import { getAutoRefreshMap } from "@/lib/automations/autorefresh";
// Only the RECENCY helper, deliberately. Lifetime error counts have no place
// on a work queue: an error from six months ago is not work, and mixing the
// two is how "614 errors" ends up looking like 614 open problems.
import { getDaysSinceLastErrorByPlatform } from "@/lib/automations/errors";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

/** How long an ACTIVE automation can go without running before it is worth a
 *  look. Nothing enforces this; it is a judgement call made visible. */
const STALE_DAYS = 90;
/** The window "recent errors" means for the purpose of the queue. */
const ERROR_WINDOW_DAYS = 7;

type Urgency = "now" | "soon" | "tidy";

interface QueueItem {
  key: string;
  urgency: Urgency;
  icon: React.ElementType;
  title: string;
  /** Why it matters. The part every other layout leaves to the reader. */
  detail: string;
  /** The figure the item is about, shown on the right. */
  count: number;
  countLabel: string;
  /** The action that would clear it, as a static label. */
  action: string;
  /** Website slugs this item belongs to, for the Sources panel tally. */
  sites: string[];
}

const URGENCY: Record<
  Urgency,
  { label: string; blurb: string; bar: string; chip: string; icon: string }
> = {
  now: {
    label: "Now",
    blurb: "Something is broken or unwatched",
    bar: "bg-red-500",
    chip: "bg-red-50 text-red-700 ring-red-600/20",
    icon: "text-red-600",
  },
  soon: {
    label: "Soon",
    blurb: "Working, but drifting",
    bar: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 ring-amber-600/25",
    icon: "text-amber-600",
  },
  tidy: {
    label: "Housekeeping",
    blurb: "Nothing is wrong, the records are just thin",
    bar: "bg-zinc-400",
    chip: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
    icon: "text-zinc-500",
  },
};

const ORDER: Urgency[] = ["now", "soon", "tidy"];

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsAlpha5Page() {
  await requireAuth();

  const autoRefreshMap = await getAutoRefreshMap();
  const daysSinceErrorByPlatform = await getDaysSinceLastErrorByPlatform();

  const grouped = await db
    .select({
      platform: automations.platform,
      status: automations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(automations)
    .groupBy(automations.platform, automations.status);

  // Inventory quality in one pass. `filter (where ...)` keeps it to a single
  // scan instead of one query per question. Empty strings count as missing:
  // a blank Purpose is not a filled-in Purpose.
  const [quality] = await db
    .select({
      noPurpose: sql<number>`count(*) filter (where ${automations.purpose} is null or btrim(${automations.purpose}) = '')::int`,
      noNotes: sql<number>`count(*) filter (where ${automations.notes} is null or btrim(${automations.notes}) = '')::int`,
      staleActive: sql<number>`count(*) filter (where ${automations.status} = 'active' and (${automations.lastRunAt} is null or ${automations.lastRunAt} < now() - make_interval(days => ${STALE_DAYS})))::int`,
    })
    .from(automations);

  // Errors inside the queue's window, per website. The lifetime totals the
  // other layouts show cannot distinguish "broken now" from "was broken once".
  const recentErrorRows = await db
    .select({
      platform: automationErrors.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(automationErrors)
    .where(
      sql`${automationErrors.occurredAt} >= now() - make_interval(days => ${ERROR_WINDOW_DAYS})`,
    )
    .groupBy(automationErrors.platform);
  const recentErrorsByPlatform: Record<string, number> = {};
  for (const row of recentErrorRows) {
    recentErrorsByPlatform[row.platform] = row.count;
  }

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
  const portfolioTotal = AUTOMATION_SITES.reduce(
    (sum, site) => sum + (statsByPlatform.get(site.slug)?.total ?? 0),
    0,
  );

  // ---- Build the queue. This is the whole page: the layout above is just
  // how it gets displayed. ----
  const items: QueueItem[] = [];

  // A website nothing can sync from is the most serious state on the page,
  // because every OTHER number about it is frozen at whatever it was.
  for (const site of AUTOMATION_SITES) {
    if (platformHasApiKey(site.slug)) continue;
    const total = statsByPlatform.get(site.slug)?.total ?? 0;
    items.push({
      key: `nokey-${site.slug}`,
      urgency: "now",
      icon: KeyRound,
      title: `${site.label} has no API integration`,
      detail: `Nothing syncs, so its ${total} rows only change when someone imports a CSV. Status, errors and run times are all frozen.`,
      count: total,
      countLabel: "rows affected",
      action: "Open Feature Integration",
      sites: [site.slug],
    });
  }

  // Fresh errors. Same day is "now"; anything else inside the window is
  // "soon", since it is already over and may have been dealt with.
  for (const site of AUTOMATION_SITES) {
    const recent = recentErrorsByPlatform[site.slug] ?? 0;
    if (recent === 0) continue;
    const days = daysSinceErrorByPlatform[site.slug];
    const sameDay = days !== undefined && days <= 1;
    items.push({
      key: `errors-${site.slug}`,
      urgency: sameDay ? "now" : "soon",
      icon: AlertTriangle,
      title: sameDay
        ? `${site.label} is erroring today`
        : `${site.label} errored in the last ${ERROR_WINDOW_DAYS} days`,
      detail: sameDay
        ? `${recent} errors in the last ${ERROR_WINDOW_DAYS} days, the most recent one today. Whatever is failing is still failing.`
        : `${recent} errors in the last ${ERROR_WINDOW_DAYS} days, most recently ${days}d ago. Worth a look before it repeats.`,
      count: recent,
      countLabel: "recent errors",
      action: "Open Error History",
      sites: [site.slug],
    });
  }

  // Auto-refresh off is one item, not one per website: it is the same decision
  // repeated, and a queue of near-identical rows is a queue people ignore.
  const refreshOff = AUTOMATION_SITES.filter(
    (site) => !(autoRefreshMap[site.slug]?.enabled ?? false),
  );
  if (refreshOff.length > 0) {
    items.push({
      key: "refresh-off",
      urgency: "soon",
      icon: RefreshCw,
      title: `Auto-refresh is off for ${refreshOff.length} ${refreshOff.length === 1 ? "website" : "websites"}`,
      detail: `${refreshOff.map((s) => s.label).join(", ")}. Their rows, and their error sweeps, only update when someone presses Refresh List.`,
      count: refreshOff.length,
      countLabel: "websites",
      action: "Turn on",
      sites: refreshOff.map((s) => s.slug),
    });
  }

  if (quality?.staleActive) {
    items.push({
      key: "stale-active",
      urgency: "soon",
      icon: Clock,
      title: `${quality.staleActive} active automations have not run in ${STALE_DAYS} days`,
      detail:
        "Marked active but idle. Either they are waiting on a trigger that never fires, or they should be paused and stop counting as live.",
      count: quality.staleActive,
      countLabel: "automations",
      action: "Review",
      sites: [],
    });
  }

  if (quality?.noPurpose) {
    items.push({
      key: "no-purpose",
      urgency: "tidy",
      icon: Target,
      title: `${quality.noPurpose} rows have no Purpose`,
      detail: `Out of ${portfolioTotal}. Purpose is the field that tells the next person why an automation exists, and it is the one that cannot be recovered from the source website.`,
      count: quality.noPurpose,
      countLabel: "rows",
      action: "Fill in",
      sites: [],
    });
  }

  if (quality?.noNotes) {
    items.push({
      key: "no-notes",
      urgency: "tidy",
      icon: StickyNote,
      title: `${quality.noNotes} rows have no Notes`,
      detail: `Out of ${portfolioTotal}. Lower stakes than Purpose, but it is where the caveats and gotchas end up living.`,
      count: quality.noNotes,
      countLabel: "rows",
      action: "Fill in",
      sites: [],
    });
  }

  const counts: Record<Urgency, number> = {
    now: items.filter((i) => i.urgency === "now").length,
    soon: items.filter((i) => i.urgency === "soon").length,
    tidy: items.filter((i) => i.urgency === "tidy").length,
  };

  // Open items per website, so the Sources panel can say which ones are clear.
  const openBySite: Record<string, number> = {};
  for (const site of AUTOMATION_SITES) openBySite[site.slug] = 0;
  for (const item of items) {
    for (const slug of item.sites) {
      if (slug in openBySite) openBySite[slug] += 1;
    }
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Automations
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha5
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {items.length > 0
              ? `${items.length} ${items.length === 1 ? "thing needs" : "things need"} doing across ${AUTOMATION_SITES.length} automation websites.`
              : `Nothing needs doing across ${AUTOMATION_SITES.length} automation websites.`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="tabular-nums">{portfolioTotal} tracked</span>
          <span className="text-zinc-300">/</span>
          <span className="tabular-nums">
            {AUTOMATION_SITES.filter((s) => platformHasApiKey(s.slug)).length} of{" "}
            {AUTOMATION_SITES.length} connected
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-card px-6 py-20 text-center ring-1 ring-foreground/10">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <h2 className="font-heading text-lg font-semibold text-zinc-900">
            Nothing needs you
          </h2>
          <p className="max-w-sm text-sm text-zinc-500">
            Every website is connected and refreshing, no errors in the last{" "}
            {ERROR_WINDOW_DAYS} days, and every row has a Purpose and Notes.
          </p>
        </div>
      ) : (
        <>
          {/* One bar for the whole queue's shape: how much is urgent versus
              how much is tidying. Reading it takes less time than counting the
              rows below. */}
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              {ORDER.map((urgency) =>
                counts[urgency] > 0 ? (
                  <span
                    key={urgency}
                    className={URGENCY[urgency].bar}
                    style={{
                      width: `${(counts[urgency] / items.length) * 100}%`,
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {ORDER.map((urgency) => (
                <span
                  key={urgency}
                  className="flex items-center gap-2 text-xs text-zinc-600"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      URGENCY[urgency].bar,
                    )}
                  />
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {counts[urgency]}
                  </span>
                  {URGENCY[urgency].label}
                  <span className="hidden text-zinc-400 sm:inline">
                    ({URGENCY[urgency].blurb})
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
            {/* ---- The queue itself, grouped by urgency. ---- */}
            <div className="space-y-4">
              {ORDER.map((urgency) => {
                const bucket = items.filter((i) => i.urgency === urgency);
                if (bucket.length === 0) return null;
                return (
                  <div
                    key={urgency}
                    className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
                  >
                    <div className="flex items-center gap-2 border-b px-4 py-2.5">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          URGENCY[urgency].bar,
                        )}
                      />
                      <h2 className="font-heading text-sm font-semibold text-zinc-900">
                        {URGENCY[urgency].label}
                      </h2>
                      <span className="text-xs text-zinc-500">
                        {URGENCY[urgency].blurb}
                      </span>
                      <span className="ml-auto text-xs font-semibold tabular-nums text-zinc-500">
                        {bucket.length}
                      </span>
                    </div>
                    <ul className="divide-y">
                      {bucket.map((item) => (
                        <li
                          key={item.key}
                          className="flex flex-wrap items-start gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:flex-nowrap"
                        >
                          <item.icon
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              URGENCY[item.urgency].icon,
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-zinc-900 [overflow-wrap:anywhere]">
                              {item.title}
                            </div>
                            {/* The reason. This is the sentence every other
                                layout makes the reader supply themselves. */}
                            <p className="mt-1 text-xs leading-relaxed text-zinc-500 [overflow-wrap:anywhere]">
                              {item.detail}
                            </p>
                            {item.sites.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {item.sites.map((slug) => {
                                  const site = AUTOMATION_SITES.find(
                                    (s) => s.slug === slug,
                                  );
                                  return (
                                    <span
                                      key={slug}
                                      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 [overflow-wrap:anywhere]"
                                    >
                                      <span
                                        aria-hidden
                                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                                        style={{
                                          backgroundColor: ACCENT[slug],
                                        }}
                                      />
                                      {site?.label ?? slug}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <div className="font-heading text-lg font-semibold leading-none tabular-nums text-zinc-900">
                                {item.count}
                              </div>
                              <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                                {item.countLabel}
                              </div>
                            </div>
                            <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-zinc-700 ring-1 ring-foreground/10">
                              {item.action}
                              <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* ---- Right column: the queue tied back to the websites, so a
                    clean website is visible as clean. ---- */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                <div className="border-b px-4 py-2.5">
                  <h2 className="font-heading text-sm font-semibold text-zinc-900">
                    By website
                  </h2>
                </div>
                <ul className="divide-y">
                  {AUTOMATION_SITES.map((site) => {
                    const open = openBySite[site.slug] ?? 0;
                    const s = statsByPlatform.get(site.slug) ?? {
                      total: 0,
                      active: 0,
                      paused: 0,
                    };
                    return (
                      <li
                        key={site.slug}
                        className="flex items-center gap-2.5 px-4 py-2.5"
                      >
                        <span
                          aria-hidden
                          className="h-7 w-[3px] shrink-0 rounded-full"
                          style={{ backgroundColor: ACCENT[site.slug] }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-zinc-800">
                            {site.label}
                          </span>
                          <span className="block text-[11px] tabular-nums text-zinc-500">
                            {s.total} tracked
                          </span>
                        </span>
                        {open > 0 ? (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 ring-1 ring-amber-600/20">
                            {open}
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Clear
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                <div className="border-b px-4 py-2.5">
                  <h2 className="font-heading text-sm font-semibold text-zinc-900">
                    Tools
                  </h2>
                </div>
                <div className="p-2">
                  <RowTool icon={Plug} label="Feature Integration" />
                  <RowTool icon={List} label="View All Lists" />
                  <RowTool icon={ListChecks} label="Dropdown Configuration" />
                </div>
              </div>

              <p className="px-1 text-[11px] leading-relaxed text-zinc-400">
                Lifetime error totals are deliberately absent. This page only
                counts the last {ERROR_WINDOW_DAYS} days, because an error from
                six months ago is not work.
              </p>
            </div>
          </div>
        </>
      )}

      <p className="pt-1 text-center text-xs text-zinc-400">
        Alpha5 preview. Controls on this page are static, the live hub is at{" "}
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

function RowTool({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-zinc-600">
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-3 w-3 shrink-0 text-zinc-300" />
    </span>
  );
}
