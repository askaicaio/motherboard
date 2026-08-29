// =============================================================
// Automations ALPHA3 - master and detail
// =============================================================
// The fourth presentation of the Automations hub, alongside the live page,
// Alpha and Alpha2. Real data, static controls, nothing writes.
//
// PREMISE, which is what makes it different: the live page and Alpha lay all 5
// websites out at once and give each one an equal, shallow slice of the screen.
// That is a summary, and a summary is what you want when everything is fine.
// This one assumes you arrive because ONE website is on your mind, so it gives
// that website the whole canvas and demotes the other four to a rail.
//
// Depth the flat layouts have no room for, per selected website:
//   - its own latest errors, with the message text
//   - what was edited on the platform most recently, which no hub surface
//     shows today
//   - its connection, refresh, and error-recency facts in one meta strip
//
// Selection is a real URL query (?site=<slug>), so the rail is genuine
// navigation rather than a mock. Everything else is a static visual.
// =============================================================

import Link from "next/link";
import {
  Activity,
  ChevronRight,
  Clock,
  Inbox,
  KeyRound,
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
import {
  getErrorCountsByPlatform,
  getDaysSinceLastErrorByPlatform,
} from "@/lib/automations/errors";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Per-website accent colour, same values the other proposals use. Local to the
// page so sites.ts stays as it is.
const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

/** Rows each detail panel list shows before it stops. */
const PANEL_ROWS = 6;

interface PlatformStats {
  total: number;
  active: number;
  paused: number;
}

export default async function AutomationsAlpha3Page({
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

  const lastRunRows = await db
    .select({
      platform: automations.platform,
      lastRunAt: sql<Date | null>`max(${automations.lastRunAt})`,
    })
    .from(automations)
    .groupBy(automations.platform);

  // The selected website's newest errors, with the message text. The per-card
  // layouts have room for a COUNT and nothing else.
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

  // What was edited most recently ON THE SOURCE WEBSITE (the synced
  // `last_edited_at`, not our own Row Update). No hub surface shows this today,
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

  const lastRunByPlatform: Record<string, Date | null> = {};
  for (const row of lastRunRows) {
    lastRunByPlatform[row.platform] = row.lastRunAt
      ? new Date(row.lastRunAt)
      : null;
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
  const refreshOn = autoRefreshMap[selected.slug]?.enabled ?? false;
  const activePct = stats.total ? (stats.active / stats.total) * 100 : 0;
  const pausedPct = stats.total ? (stats.paused / stats.total) * 100 : 0;
  const status: { tone: Tone; label: string } = !hasKey
    ? { tone: "off", label: "Not connected" }
    : days !== undefined && days <= 1
      ? { tone: "bad", label: "Erroring" }
      : days !== undefined && days <= 7
        ? { tone: "warn", label: "Recent errors" }
        : { tone: "ok", label: "Healthy" };

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Automations
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Alpha3
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

      {/* One pane, split. The rail is the master list, the panel is the detail
          view. Both scroll inside the pane rather than the page, so the split
          never comes apart as the detail content grows. */}
      <div className="flex min-h-[640px] overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {/* ---- Rail. Every website, always visible, so switching costs one
                click and you never lose your bearings. ---- */}
        <div className="flex w-64 shrink-0 flex-col border-r">
          <div className="border-b px-4 py-3">
            <div className="font-heading text-sm font-semibold text-zinc-900">
              Sources
            </div>
            {/* The aggregate the rest of this layout deliberately gives up, in
                one line so nothing is actually lost. */}
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
              const siteErrorCount = errorCounts[site.slug] ?? 0;
              return (
                <Link
                  key={site.slug}
                  href={`/automations-beta3?site=${site.slug}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
                    isCurrent ? "bg-zinc-100" : "hover:bg-zinc-50",
                  )}
                >
                  {/* Accent spine, full opacity on the selected row and faint
                      on the rest, so the current website is obvious without a
                      second indicator. */}
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
                    <span
                      className={cn(
                        "block truncate text-sm",
                        isCurrent
                          ? "font-semibold text-zinc-900"
                          : "font-medium text-zinc-700",
                      )}
                    >
                      {site.label}
                    </span>
                    <span className="block text-[11px] tabular-nums text-zinc-500">
                      {s.total} tracked
                    </span>
                  </span>
                  {siteErrorCount > 0 && (
                    <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-red-600">
                      {siteErrorCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-2">
            <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Tools
            </div>
            <RailTool icon={Plug} label="Feature Integration" />
            <RailTool icon={List} label="View All Lists" />
            <RailTool icon={ListChecks} label="Dropdown Configuration" />
          </div>
        </div>

        {/* ---- Detail panel for the selected website. ---- */}
        <div className="min-w-0 flex-1">
          {/* Header, tinted with the website's own colour so the panel changes
              character as you move down the rail. */}
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
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-600">
                    {selected.description}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-zinc-600 ring-1 ring-foreground/10">
                  Error History
                </span>
                <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-zinc-900 px-2.5 text-xs font-medium text-white">
                  View list
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            {/* Four figures, then the split as a proportion. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Figure label="Tracked" value={stats.total} />
              <Figure
                label="Active"
                value={stats.active}
                valueClassName="text-emerald-600"
              />
              <Figure label="Paused" value={stats.paused} />
              <Figure
                label="Errors"
                value={errors}
                valueClassName={errors > 0 ? "text-red-600" : "text-zinc-400"}
              />
            </div>

            <div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
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
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  {stats.active} active
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                  {stats.paused} paused
                </span>
                <span className="text-zinc-400">
                  {stats.total
                    ? `${Math.round(activePct)}% of this website is running`
                    : "nothing tracked yet"}
                </span>
              </div>
            </div>

            {/* Meta strip: the facts the live page spends two labelled rows and
                a full-width button on, folded into one line of four. */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-3 sm:grid-cols-4">
              <Meta
                icon={KeyRound}
                label="API key"
                value={hasKey ? "Integrated" : "Missing"}
                tone={hasKey ? "ok" : "bad"}
              />
              <Meta
                icon={RefreshCw}
                label="Auto-refresh"
                value={refreshOn ? "On" : "Off"}
                tone={refreshOn ? "ok" : "muted"}
              />
              <Meta
                icon={Clock}
                label="Last run"
                value={agoLabel(lastRunByPlatform[selected.slug] ?? null)}
                tone="muted"
              />
              <Meta
                icon={Activity}
                label="Last error"
                value={days !== undefined ? `${days}d ago` : "Not tracked"}
                tone={days !== undefined && days <= 7 ? "bad" : "muted"}
              />
            </div>

            {/* The two lists that only fit because this layout gave one website
                the whole canvas. */}
            <div className="grid gap-4 lg:grid-cols-2">
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
                          row.lastEditedAt ? new Date(row.lastEditedAt) : null,
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
            </div>
          </div>
        </div>
      </div>

      <p className="pt-1 text-center text-xs text-zinc-400">
        Alpha3 preview. The rail navigates; every other control is static. The
        live hub is at{" "}
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

function Figure({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg px-3 py-2.5 ring-1 ring-foreground/10">
      <div
        className={cn(
          "font-heading text-2xl font-semibold leading-none tabular-nums text-zinc-900",
          valueClassName,
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "ok" | "bad" | "muted";
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate text-sm font-medium",
          tone === "ok"
            ? "text-emerald-700"
            : tone === "bad"
              ? "text-red-600"
              : "text-zinc-700",
        )}
      >
        {value}
      </div>
    </div>
  );
}

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

function RailTool({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-600">
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-3 w-3 shrink-0 text-zinc-300" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Time labels. Coarse on purpose: these are glanceable states, not timestamps,
// and the exact values still live on the per-website pages.
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
