// =============================================================
// Automations ALPHA7 - a changelog
// =============================================================
// The eighth and last presentation of the Automations hub.
//
// PREMISE: every other layout, all six proposals before it included, shows a
// SNAPSHOT. Numbers as they stand right now, with the past compressed into at
// best a sparkline. But an estate of 899 automations across 5 websites is
// something that CHANGES, and the interesting question is often not "what is
// true" but "what changed, and when". So this page has no cards, no table and
// no totals. It is one stream, newest first, of everything that happened.
//
// Four kinds of event, all of them from timestamps we already store and none
// of them surfaced chronologically anywhere in the app today:
//
//   Failed        an error was captured           (automation_errors)
//   Edited here   someone changed a row in this app   (row_updated_at)
//   Changed there the source website changed it   (last_edited_at)
//   Added         the sync first saw it           (created_at)
//
// "Changed there" plus "Edited here" side by side is the pairing that makes
// this worth building: it is the only view where our own edits and the source
// website's edits sit on one timeline and can be told apart.
//
// The type filter is real (?type=). Everything else is a static visual.
// =============================================================

import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  List,
  ListChecks,
  PencilLine,
  Plug,
  Plus,
  RefreshCw,
} from "lucide-react";
import { desc, eq, isNotNull } from "drizzle-orm";

import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automationErrors, automations } from "@/lib/db/schema";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

/** Rows pulled per event source before merging. Deliberately generous, so the
 *  merged stream is not dominated by whichever source happens to be busiest. */
const PER_SOURCE = 40;
/** Events kept after the merge. */
const STREAM_LIMIT = 60;

type EventType = "error" | "edited-here" | "changed-there" | "added";

const TYPES: {
  key: EventType;
  label: string;
  icon: React.ElementType;
  dot: string;
  /** What the event actually means, shown under the filter chips. */
  blurb: string;
}[] = [
  {
    key: "error",
    label: "Failed",
    icon: AlertTriangle,
    dot: "bg-red-500",
    blurb: "an error was captured",
  },
  {
    key: "edited-here",
    label: "Edited here",
    icon: PencilLine,
    dot: "bg-blue-500",
    blurb: "someone changed a row in this app",
  },
  {
    key: "changed-there",
    label: "Changed there",
    icon: RefreshCw,
    dot: "bg-amber-500",
    blurb: "the source website changed it",
  },
  {
    key: "added",
    label: "Added",
    icon: Plus,
    dot: "bg-emerald-500",
    blurb: "the sync first saw it",
  },
];

const TYPE_BY_KEY = new Map(TYPES.map((t) => [t.key, t]));

interface StreamEvent {
  id: string;
  type: EventType;
  at: Date;
  platform: string;
  name: string;
  /** Extra line, only the error events have one. */
  detail?: string | null;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default async function AutomationsAlpha7Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  await requireAuth();

  // Read on the SERVER, so the filter chips are plain links and the page needs
  // no client JS. An unknown value means "no filter" rather than an error.
  const { type: typeParam } = await searchParams;
  const requestedType = Array.isArray(typeParam) ? typeParam[0] : typeParam;
  const activeType = TYPE_BY_KEY.has(requestedType as EventType)
    ? (requestedType as EventType)
    : null;

  // Each source is fetched separately and merged in JS. One UNION query would
  // be tidier SQL, but the four sources have genuinely different shapes and
  // only the errors carry a message, so this stays readable.
  const wants = (t: EventType) => !activeType || activeType === t;

  const errorRows = wants("error")
    ? await db
        .select({
          id: automationErrors.id,
          platform: automationErrors.platform,
          message: automationErrors.message,
          occurredAt: automationErrors.occurredAt,
          name: automations.name,
        })
        .from(automationErrors)
        .innerJoin(
          automations,
          eq(automationErrors.automationId, automations.id),
        )
        .orderBy(desc(automationErrors.occurredAt))
        .limit(PER_SOURCE)
    : [];

  const editedHereRows = wants("edited-here")
    ? await db
        .select({
          id: automations.id,
          platform: automations.platform,
          name: automations.name,
          at: automations.rowUpdatedAt,
        })
        .from(automations)
        .where(isNotNull(automations.rowUpdatedAt))
        .orderBy(desc(automations.rowUpdatedAt))
        .limit(PER_SOURCE)
    : [];

  const changedThereRows = wants("changed-there")
    ? await db
        .select({
          id: automations.id,
          platform: automations.platform,
          name: automations.name,
          at: automations.lastEditedAt,
        })
        .from(automations)
        .where(isNotNull(automations.lastEditedAt))
        .orderBy(desc(automations.lastEditedAt))
        .limit(PER_SOURCE)
    : [];

  const addedRows = wants("added")
    ? await db
        .select({
          id: automations.id,
          platform: automations.platform,
          name: automations.name,
          at: automations.createdAt,
        })
        .from(automations)
        .orderBy(desc(automations.createdAt))
        .limit(PER_SOURCE)
    : [];

  const events: StreamEvent[] = [
    ...errorRows.map((r) => ({
      // Suffixed because one automation can appear under several event types,
      // and React keys have to be unique across the merged stream.
      id: `error-${r.id}`,
      type: "error" as EventType,
      at: new Date(r.occurredAt),
      platform: r.platform,
      name: r.name,
      detail: r.message,
    })),
    ...editedHereRows.map((r) => ({
      id: `here-${r.id}`,
      type: "edited-here" as EventType,
      at: new Date(r.at as Date),
      platform: r.platform,
      name: r.name,
    })),
    ...changedThereRows.map((r) => ({
      id: `there-${r.id}`,
      type: "changed-there" as EventType,
      at: new Date(r.at as Date),
      platform: r.platform,
      name: r.name,
    })),
    ...addedRows.map((r) => ({
      id: `added-${r.id}`,
      type: "added" as EventType,
      at: new Date(r.at),
      platform: r.platform,
      name: r.name,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, STREAM_LIMIT);

  // Counts across what is actually on screen. Labelled "in view" rather than
  // presented as totals, because each source was capped before the merge and
  // a capped count dressed up as a total is just a wrong number.
  const inView: Record<EventType, number> = {
    error: 0,
    "edited-here": 0,
    "changed-there": 0,
    added: 0,
  };
  for (const e of events) inView[e.type] += 1;

  // Group into days, preserving the newest-first order.
  const days: { key: string; label: string; events: StreamEvent[] }[] = [];
  for (const event of events) {
    const key = event.at.toISOString().slice(0, 10);
    const last = days[days.length - 1];
    if (last?.key === key) last.events.push(event);
    else days.push({ key, label: dayLabel(event.at), events: [event] });
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
              Alpha7
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            What changed across all {AUTOMATION_SITES.length} automation
            websites, newest first.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" />
          times in UTC
        </span>
      </div>

      {/* ---- Filters. Four event kinds, each with the sentence explaining what
              it actually means, since "Edited here" versus "Changed there" is
              a distinction nothing else in the app draws. ---- */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/automations-beta7"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              !activeType
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-700 ring-1 ring-foreground/10 hover:bg-zinc-50",
            )}
          >
            Everything
            <span className="tabular-nums text-zinc-400">{events.length}</span>
          </Link>
          {TYPES.map((type) => (
            <Link
              key={type.key}
              href={`/automations-beta7?type=${type.key}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                activeType === type.key
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-700 ring-1 ring-foreground/10 hover:bg-zinc-50",
              )}
            >
              <span
                aria-hidden
                className={cn("h-2 w-2 shrink-0 rounded-full", type.dot)}
              />
              {type.label}
              <span className="tabular-nums text-zinc-400">
                {inView[type.key]}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {TYPES.map((type) => (
            <span
              key={type.key}
              className="flex items-center gap-1.5 text-[11px] text-zinc-500"
            >
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", type.dot)}
              />
              <span className="font-medium text-zinc-700">{type.label}</span>
              {type.blurb}
            </span>
          ))}
        </div>
      </div>

      {/* ---- The stream. One column, a rail down the left, day headers, and
              nothing else competing for attention. ---- */}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-zinc-900">
            {activeType ? TYPE_BY_KEY.get(activeType)?.label : "All activity"}
          </h2>
          <span className="text-xs text-zinc-500">
            {events.length === STREAM_LIMIT
              ? `most recent ${STREAM_LIMIT} events`
              : `${events.length} ${events.length === 1 ? "event" : "events"}`}
          </span>
        </div>

        {events.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-zinc-500">
            Nothing has happened yet.
          </p>
        ) : (
          <div className="divide-y">
            {days.map((day) => (
              <div key={day.key}>
                <div className="flex items-center gap-2 bg-muted/40 px-4 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {day.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-zinc-400">
                    {day.events.length}
                  </span>
                </div>
                <ul>
                  {day.events.map((event) => {
                    const type = TYPE_BY_KEY.get(event.type);
                    const site = AUTOMATION_SITES.find(
                      (s) => s.slug === event.platform,
                    );
                    if (!type) return null;
                    return (
                      <li
                        key={event.id}
                        className="flex gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
                      >
                        <span className="w-10 shrink-0 pt-0.5 text-[11px] tabular-nums text-zinc-400">
                          {hhmm(event.at)}
                        </span>
                        {/* The rail. A continuous hairline with the event's own
                            dot sitting on it, so the column reads as one
                            timeline rather than a list of rows. */}
                        <span
                          aria-hidden
                          className="relative flex w-3 shrink-0 justify-center"
                        >
                          <span className="absolute inset-y-[-10px] w-px bg-zinc-200" />
                          <span
                            className={cn(
                              "relative mt-1.5 h-2 w-2 rounded-full ring-2 ring-white",
                              type.dot,
                            )}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-xs font-semibold text-zinc-500">
                              {type.label}
                            </span>
                            <span className="text-sm text-zinc-900 [overflow-wrap:anywhere]">
                              {event.name}
                            </span>
                          </div>
                          {event.detail ? (
                            <p className="mt-0.5 truncate text-xs text-zinc-500">
                              {event.detail}
                            </p>
                          ) : null}
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                ACCENT[event.platform] ?? "#a1a1aa",
                            }}
                          />
                          <span className="text-[11px] text-zinc-500">
                            {site?.label ?? event.platform}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          <Tool icon={Plug} label="Feature Integration" />
          <Tool icon={List} label="View All Lists" />
          <Tool icon={ListChecks} label="Dropdown Configuration" />
        </div>
        <p className="px-1 text-[11px] leading-relaxed text-zinc-400">
          Each event kind is fetched separately, capped at {PER_SOURCE}, then
          merged and cut to {STREAM_LIMIT}, so the busiest kind cannot crowd the
          others out. The chip counts describe what is on screen, not totals.
          &ldquo;Added&rdquo; is when the sync first saw a row, which for the
          backfilled websites is the import date rather than the date the
          automation was built.
        </p>
      </div>

      <p className="pt-1 text-center text-xs text-zinc-400">
        Alpha7 preview. The type filters work; every other control is static. The
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

// ---------------------------------------------------------------------------
// Dates. Everything is rendered in UTC and the page header says so, rather
// than guessing at the reader's zone and being quietly wrong by a few hours.
// Month names come from a fixed list so the output never depends on a locale.
// ---------------------------------------------------------------------------

function hhmm(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function dayLabel(date: Date): string {
  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const that = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const daysAgo = Math.round((today - that) / 86_400_000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  const label = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === now.getUTCFullYear()
    ? label
    : `${label} ${date.getUTCFullYear()}`;
}
