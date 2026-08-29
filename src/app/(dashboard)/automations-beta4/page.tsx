// =============================================================
// Automations ALPHA4 - search first
// =============================================================
// The fifth presentation of the Automations hub, alongside the live page,
// Alpha, Alpha2 and Alpha3.
//
// PREMISE: every other layout treats this page as a REPORT. It shows you how
// the estate is doing and assumes that is why you came. But with 899 rows
// spread over 5 websites, the likeliest reason anyone opens this tab is to
// find ONE automation, and today that means picking the right website card
// first, then searching inside its table. This layout inverts that: the hub
// becomes a launcher, and the totals are demoted to a strip along the bottom.
//
// The search is REAL (a plain GET form, matched server-side across all 5
// websites at once, which nothing in the app can do today). Everything else
// is a static visual.
// =============================================================

import Link from "next/link";
import {
  Activity,
  ChevronRight,
  CornerDownLeft,
  Inbox,
  List,
  ListChecks,
  Plug,
  Search,
} from "lucide-react";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { platformHasApiKey } from "@/lib/automations/credentials";
import {
  getErrorCountsByPlatform,
  getDaysSinceLastErrorByPlatform,
} from "@/lib/automations/errors";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

/** Results shown for one query before the list stops. */
const RESULT_LIMIT = 25;
/** Rows in the "recently touched" list that stands in for empty results. */
const RECENT_LIMIT = 8;

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsAlpha4Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; site?: string | string[] }>;
}) {
  await requireAuth();

  // Both read on the SERVER, so the search box is a plain GET form and the
  // page needs no client JS at all. Repeated params come back as an array.
  const { q: qParam, site: siteParam } = await searchParams;
  const query = ((Array.isArray(qParam) ? qParam[0] : qParam) ?? "").trim();
  const requestedSite = Array.isArray(siteParam) ? siteParam[0] : siteParam;
  // An unknown slug is treated as "no filter" rather than an error.
  const siteFilter = AUTOMATION_SITES.find((s) => s.slug === requestedSite);

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

  // The search itself: name OR link, across every website at once unless a
  // chip narrowed it. Drizzle parameterizes the pattern, so the raw input is
  // never interpolated into SQL.
  const conditions = [];
  if (query) {
    conditions.push(
      or(
        ilike(automations.name, `%${query}%`),
        ilike(automations.externalUrl, `%${query}%`),
      ),
    );
  }
  if (siteFilter) conditions.push(eq(automations.platform, siteFilter.slug));

  const results = query
    ? await db
        .select({
          id: automations.id,
          name: automations.name,
          platform: automations.platform,
          status: automations.status,
          purpose: automations.purpose,
          externalUrl: automations.externalUrl,
        })
        .from(automations)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0])
        .orderBy(asc(automations.name))
        .limit(RESULT_LIMIT)
    : [];

  // With no query the results area would be dead space, so it holds the rows
  // that changed most recently instead. `row_updated_at` is our own in-app
  // edit stamp, `last_edited_at` the platform's, so the newer of the two is
  // the honest answer to "what moved".
  const recent = query
    ? []
    : await db
        .select({
          id: automations.id,
          name: automations.name,
          platform: automations.platform,
          status: automations.status,
          purpose: automations.purpose,
          touchedAt: sql<Date | null>`greatest(${automations.rowUpdatedAt}, ${automations.lastEditedAt})`,
        })
        .from(automations)
        .where(
          siteFilter ? eq(automations.platform, siteFilter.slug) : undefined,
        )
        .orderBy(
          sql`greatest(${automations.rowUpdatedAt}, ${automations.lastEditedAt}) desc nulls last`,
        )
        .limit(RECENT_LIMIT);

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Automations
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha4
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Tracks workflows from different automation websites all in one
            place.
          </p>
        </div>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-zinc-700">
          <Activity className="h-4 w-4" />
          Run health check
        </span>
      </div>

      {/* ---- The launcher. Given the whole top of the page, because on this
              layout finding a row IS the primary job and everything else is
              context for it. ---- */}
      <div className="rounded-2xl bg-card px-6 py-8 ring-1 ring-foreground/10 sm:px-10 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-heading text-lg font-semibold text-zinc-900">
            Find an automation
          </h2>
          <p className="mt-1 text-center text-sm text-zinc-500">
            One search across all {AUTOMATION_SITES.length} websites. Today you
            have to pick a website first, then search inside its table.
          </p>

          {/* A plain GET form: submitting navigates to ?q=..., which the server
              reads above. No client JS, and the browser's own history and back
              button work on searches for free. */}
          <form action="/automations-beta4" method="get" className="mt-5">
            {/* Keeps an active website chip applied across a new search. */}
            {siteFilter && (
              <input type="hidden" name="site" value={siteFilter.slug} />
            )}
            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 ring-1 ring-foreground/15 focus-within:ring-2 focus-within:ring-zinc-400">
              <Search className="h-5 w-5 shrink-0 text-zinc-400" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder={`Search ${portfolioTotal} automations by name or link`}
                aria-label="Search automations"
                className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
              <span className="hidden shrink-0 items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-1 text-[10px] font-medium text-zinc-500 sm:inline-flex">
                <CornerDownLeft className="h-3 w-3" />
                Enter
              </span>
            </div>
          </form>

          {/* Website chips. They narrow the search rather than replacing it,
              which is the part that cannot be done today at all. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Chip
              href={query ? `/automations-beta4?q=${encodeURIComponent(query)}` : "/automations-beta4"}
              label="All websites"
              count={portfolioTotal}
              active={!siteFilter}
            />
            {AUTOMATION_SITES.map((site) => {
              const params = new URLSearchParams({ site: site.slug });
              if (query) params.set("q", query);
              return (
                <Chip
                  key={site.slug}
                  href={`/automations-beta4?${params.toString()}`}
                  label={site.label}
                  count={statsByPlatform.get(site.slug)?.total ?? 0}
                  active={siteFilter?.slug === site.slug}
                  accent={ACCENT[site.slug]}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- Results, or what moved recently when nothing was searched. ---- */}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-zinc-900">
            {query ? "Results" : "Recently touched"}
          </h2>
          <span className="text-xs text-zinc-500">
            {query ? (
              <>
                {results.length === RESULT_LIMIT
                  ? `first ${RESULT_LIMIT}`
                  : `${results.length} ${results.length === 1 ? "match" : "matches"}`}{" "}
                for &ldquo;{query}&rdquo;
                {siteFilter ? ` in ${siteFilter.label}` : ""}
              </>
            ) : (
              <>
                newest edits{siteFilter ? ` in ${siteFilter.label}` : ""}, ours
                or the website&rsquo;s
              </>
            )}
          </span>
        </div>

        {query && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
            <Inbox className="h-6 w-6 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              Nothing matches &ldquo;{query}&rdquo;
              {siteFilter ? ` in ${siteFilter.label}` : ""}.
            </p>
            {siteFilter && (
              <Link
                href={`/automations-beta4?q=${encodeURIComponent(query)}`}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Search all {AUTOMATION_SITES.length} websites instead
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {(query ? results : recent).map((row) => {
              const site = AUTOMATION_SITES.find(
                (s) => s.slug === row.platform,
              );
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50"
                >
                  <span
                    aria-hidden
                    className="h-8 w-[3px] shrink-0 rounded-full"
                    style={{
                      backgroundColor: ACCENT[row.platform] ?? "#a1a1aa",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-zinc-900 [overflow-wrap:anywhere]">
                        {row.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          row.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        {row.status === "active" ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-600">
                        {site?.label ?? row.platform}
                      </span>
                      {row.purpose ? (
                        <>
                          <span className="text-zinc-300">/</span>
                          <span className="truncate">{row.purpose}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---- The demoted summary. Everything the live page leads with, in one
              strip: enough to notice a problem, not enough to distract from
              the search above. ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {AUTOMATION_SITES.map((site) => {
          const s = statsByPlatform.get(site.slug) ?? {
            total: 0,
            active: 0,
            paused: 0,
          };
          const hasKey = platformHasApiKey(site.slug);
          const days = daysSinceErrorByPlatform[site.slug];
          const errors = errorCounts[site.slug] ?? 0;
          const tone: "ok" | "warn" | "bad" | "off" = !hasKey
            ? "off"
            : days !== undefined && days <= 1
              ? "bad"
              : days !== undefined && days <= 7
                ? "warn"
                : "ok";
          return (
            <div
              key={site.slug}
              className="rounded-xl bg-card p-3 ring-1 ring-foreground/10"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ACCENT[site.slug] }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-800">
                  {site.label}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    tone === "ok"
                      ? "bg-emerald-500"
                      : tone === "warn"
                        ? "bg-amber-500"
                        : tone === "bad"
                          ? "bg-red-500"
                          : "bg-zinc-300",
                  )}
                  title={
                    tone === "off"
                      ? "Not connected"
                      : tone === "bad"
                        ? "Erroring"
                        : tone === "warn"
                          ? "Recent errors"
                          : "Healthy"
                  }
                />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-heading text-xl font-semibold leading-none tabular-nums text-zinc-900">
                  {s.total}
                </span>
                <span className="text-[11px] text-zinc-500">tracked</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="tabular-nums">{s.active} active</span>
                <span
                  className={cn(
                    "tabular-nums",
                    errors > 0 ? "text-red-600" : "text-zinc-400",
                  )}
                >
                  {errors} err
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <Tool icon={Plug} label="Feature Integration" />
        <Tool icon={List} label="View All Lists" />
        <Tool icon={ListChecks} label="Dropdown Configuration" />
      </div>

      <p className="pt-1 text-center text-xs text-zinc-400">
        Alpha4 preview. The search and the website chips work; every other
        control is static. The live hub is at{" "}
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

function Chip({
  href,
  label,
  count,
  active,
  accent,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-zinc-900 text-white"
          : "bg-white text-zinc-700 ring-1 ring-foreground/10 hover:bg-zinc-50",
      )}
    >
      {accent && (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
      )}
      {label}
      <span className="tabular-nums text-zinc-400">{count}</span>
    </Link>
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
