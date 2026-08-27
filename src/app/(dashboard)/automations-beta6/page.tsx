// =============================================================
// Automations BETA6 - inventory quality
// =============================================================
// The seventh presentation of the Automations hub.
//
// PREMISE: every layout so far, the live page included, reports on how the
// automations are RUNNING. None of them reports on how well they are
// DOCUMENTED, even though most of the work that went into this tab was
// building columns to hold that documentation and backfilling them from CSVs.
// So the numbers on this page are not about the estate; they are about our
// record OF the estate. It answers "how much do we actually know", and where
// the holes are.
//
// The centrepiece is a coverage matrix: every website against every field a
// human fills in, each cell the percentage of that website's rows that have
// it. A gap is visible as a pale cell, which is a thing no counter can show.
//
// Honesty rule baked in: fields that a website CANNOT supply (the synced
// Last Runtime / Last Edited on a website with no sync) render as "n/a", not
// as 0%. A matrix that scores an impossibility as a failure is a matrix that
// lies.
//
// Real data, static controls.
// =============================================================

import Link from "next/link";
import { ChevronRight, List, ListChecks, Plug } from "lucide-react";
import { eq, sql } from "drizzle-orm";

import { requireAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import {
  automationDropdownChoices,
  automationDropdownSelections,
  automationWebhooks,
  automations,
} from "@/lib/db/schema";
import { AUTOMATION_SITES, isSyncablePlatform } from "@/lib/automations/sites";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACCENT: Record<string, string> = {
  make: "#B02DE9",
  n8n: "#EA4B71",
  ghl: "#2FBF71",
  "ghl-b2b": "#8FDDB4",
  zapier: "#FF4F00",
};

// The measured fields, in table order.
//
//   source "row"      -> a column on `automations` itself
//   source "choice"   -> a single-select FK on `automations`
//   source "multi"    -> at least one row in the dropdown-selections junction
//                        for that column_key
//   source "webhook"  -> at least one row in the webhook junction
//
// `synced: true` marks a field the SOURCE WEBSITE supplies rather than a human,
// which is why it sits in its own group and is excluded from the headline
// completeness figure. Documenting is the thing being measured here; a sync
// filling a column in is not documentation.
const FIELDS: {
  key: string;
  label: string;
  source: "row" | "choice" | "multi" | "webhook";
  synced?: boolean;
  /** Populated only via a sync, so it cannot exist without one. */
  needsSync?: boolean;
}[] = [
  { key: "purpose", label: "Purpose", source: "row" },
  { key: "notes", label: "Notes", source: "row" },
  { key: "author", label: "Author", source: "choice" },
  { key: "trigger_event", label: "Trigger Event", source: "choice" },
  { key: "automation_tags", label: "Automation Tags", source: "multi" },
  { key: "ghl_tags", label: "GHL Tags", source: "multi" },
  { key: "ghl_forms", label: "GHL Forms", source: "multi" },
  { key: "webhooks", label: "Webhook Links", source: "webhook" },
  {
    key: "lastRun",
    label: "Last Runtime",
    source: "row",
    synced: true,
    needsSync: true,
  },
  {
    key: "lastEdited",
    label: "Last Edited",
    source: "row",
    synced: true,
    needsSync: true,
  },
];

const HUMAN_FIELDS = FIELDS.filter((f) => !f.synced);

export default async function AutomationsBeta6Page() {
  await requireAuth();

  // One scan of `automations` for everything that lives on the row itself.
  // Blank strings count as missing: a blank Purpose is not a filled-in one.
  const baseRows = await db
    .select({
      platform: automations.platform,
      total: sql<number>`count(*)::int`,
      purpose: sql<number>`count(*) filter (where ${automations.purpose} is not null and btrim(${automations.purpose}) <> '')::int`,
      notes: sql<number>`count(*) filter (where ${automations.notes} is not null and btrim(${automations.notes}) <> '')::int`,
      author: sql<number>`count(*) filter (where ${automations.authorChoiceId} is not null)::int`,
      trigger_event: sql<number>`count(*) filter (where ${automations.triggerEventChoiceId} is not null)::int`,
      lastRun: sql<number>`count(*) filter (where ${automations.lastRunAt} is not null)::int`,
      lastEdited: sql<number>`count(*) filter (where ${automations.lastEditedAt} is not null)::int`,
    })
    .from(automations)
    .groupBy(automations.platform);

  // The multi-select columns all share ONE junction; which column a link
  // belongs to is implied by the linked choice's own column_key. Counting
  // DISTINCT automations is the point: 6 tags on one row is still one row
  // covered.
  const multiRows = await db
    .select({
      platform: automations.platform,
      columnKey: automationDropdownChoices.columnKey,
      filled: sql<number>`count(distinct ${automationDropdownSelections.automationId})::int`,
    })
    .from(automationDropdownSelections)
    .innerJoin(
      automations,
      eq(automationDropdownSelections.automationId, automations.id),
    )
    .innerJoin(
      automationDropdownChoices,
      eq(automationDropdownSelections.choiceId, automationDropdownChoices.id),
    )
    .groupBy(automations.platform, automationDropdownChoices.columnKey);

  // Webhook Links keeps its own junction, pointing at a different choice table.
  const webhookRows = await db
    .select({
      platform: automations.platform,
      filled: sql<number>`count(distinct ${automationWebhooks.automationId})::int`,
    })
    .from(automationWebhooks)
    .innerJoin(automations, eq(automationWebhooks.automationId, automations.id))
    .groupBy(automations.platform);

  // ---- Fold everything into one filled-count lookup: platform -> field -> n.
  const totals: Record<string, number> = {};
  const filled: Record<string, Record<string, number>> = {};
  for (const site of AUTOMATION_SITES) {
    totals[site.slug] = 0;
    filled[site.slug] = {};
  }
  for (const row of baseRows) {
    if (!(row.platform in filled)) continue;
    totals[row.platform] = row.total;
    filled[row.platform].purpose = row.purpose;
    filled[row.platform].notes = row.notes;
    filled[row.platform].author = row.author;
    filled[row.platform].trigger_event = row.trigger_event;
    filled[row.platform].lastRun = row.lastRun;
    filled[row.platform].lastEdited = row.lastEdited;
  }
  for (const row of multiRows) {
    if (!(row.platform in filled)) continue;
    filled[row.platform][row.columnKey] = row.filled;
  }
  for (const row of webhookRows) {
    if (!(row.platform in filled)) continue;
    filled[row.platform].webhooks = row.filled;
  }

  /** Whether this website can supply this field at all. */
  function applies(slug: string, field: (typeof FIELDS)[number]): boolean {
    if (field.needsSync && !isSyncablePlatform(slug)) return false;
    return true;
  }

  /** Percentage of a website's rows that have this field, 0 when it has none. */
  function pct(slug: string, fieldKey: string): number {
    const total = totals[slug] ?? 0;
    if (!total) return 0;
    return ((filled[slug]?.[fieldKey] ?? 0) / total) * 100;
  }

  // Headline: filled cells over gradeable cells, across the HUMAN fields only.
  let humanFilled = 0;
  let humanPossible = 0;
  for (const site of AUTOMATION_SITES) {
    for (const field of HUMAN_FIELDS) {
      if (!applies(site.slug, field)) continue;
      humanFilled += filled[site.slug]?.[field.key] ?? 0;
      humanPossible += totals[site.slug] ?? 0;
    }
  }
  const overall = humanPossible ? (humanFilled / humanPossible) * 100 : 0;

  // Per-field completeness across every website, for the ranked list.
  const byField = HUMAN_FIELDS.map((field) => {
    let f = 0;
    let p = 0;
    for (const site of AUTOMATION_SITES) {
      if (!applies(site.slug, field)) continue;
      f += filled[site.slug]?.[field.key] ?? 0;
      p += totals[site.slug] ?? 0;
    }
    return {
      field,
      filled: f,
      possible: p,
      pct: p ? (f / p) * 100 : 0,
    };
  }).sort((a, b) => a.pct - b.pct);

  // The thinnest individual cells, which is where the work actually is. A
  // website with 0 rows is skipped: it has no gap, it has no data.
  const gaps = AUTOMATION_SITES.flatMap((site) =>
    HUMAN_FIELDS.filter((field) => applies(site.slug, field)).map((field) => ({
      site,
      field,
      missing: (totals[site.slug] ?? 0) - (filled[site.slug]?.[field.key] ?? 0),
      pct: pct(site.slug, field.key),
    })),
  )
    .filter((g) => (totals[g.site.slug] ?? 0) > 0 && g.missing > 0)
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 6);

  const portfolioTotal = AUTOMATION_SITES.reduce(
    (sum, site) => sum + (totals[site.slug] ?? 0),
    0,
  );

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Automations
            </h1>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Beta6
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            How complete the record is, rather than how the automations are
            running.
          </p>
        </div>
        <span className="text-xs text-zinc-500">
          {portfolioTotal} rows, {HUMAN_FIELDS.length} fields a human fills in
        </span>
      </div>

      {/* ---- Headline. One number for the whole record, then the same number
              broken down per field, worst first, because that ordering IS the
              recommendation. ---- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            Documented
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-5xl font-semibold leading-none tabular-nums text-zinc-900">
              {Math.round(overall)}%
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            {humanFilled} of {humanPossible} fields filled in, counting every
            row against every field a person is meant to complete. Fields a
            website cannot supply are left out of the total rather than scored
            as zero.
          </p>
          <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <span
              className="bg-zinc-900"
              style={{ width: `${Math.min(100, overall)}%` }}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <h2 className="font-heading text-sm font-semibold text-zinc-900">
              By field
            </h2>
            <span className="text-xs text-zinc-500">thinnest first</span>
          </div>
          <ul className="divide-y">
            {byField.map(({ field, filled: f, possible, pct: p }) => (
              <li
                key={field.key}
                className="flex items-center gap-3 px-4 py-2"
              >
                <span className="w-32 shrink-0 truncate text-xs font-medium text-zinc-700">
                  {field.label}
                </span>
                <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <span
                    className={cn("rounded-full", barClass(p))}
                    style={{ width: `${Math.min(100, p)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-900">
                  {Math.round(p)}%
                </span>
                <span className="hidden w-24 shrink-0 text-right text-[11px] tabular-nums text-zinc-400 sm:block">
                  {f}/{possible}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---- The matrix. Websites down, fields across. The point of the shape
              is that a gap is VISIBLE as a pale cell, which no list of
              counters can show. ---- */}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-zinc-900">
            Coverage by website and field
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                empty
              </span>
              {[8, 30, 55, 80, 100].map((step) => (
                <span
                  key={step}
                  className={cn("h-3 w-5 rounded-sm", cellClass(step).box)}
                />
              ))}
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                full
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b text-left align-bottom">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Website
                </th>
                <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Rows
                </th>
                {FIELDS.map((field, i) => (
                  <th
                    key={field.key}
                    className={cn(
                      "px-2 py-2.5 text-center text-[11px] font-semibold leading-tight text-zinc-600",
                      // A rule where the human-filled fields end and the
                      // synced ones begin, since the two are not comparable.
                      field.synced && !FIELDS[i - 1]?.synced
                        ? "border-l"
                        : undefined,
                    )}
                  >
                    {field.label}
                    {field.synced && (
                      <span className="mt-0.5 block text-[9px] font-normal uppercase tracking-wider text-zinc-400">
                        synced
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AUTOMATION_SITES.map((site) => {
                const total = totals[site.slug] ?? 0;
                return (
                  <tr key={site.slug} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="h-6 w-[3px] shrink-0 rounded-full"
                          style={{ backgroundColor: ACCENT[site.slug] }}
                        />
                        <span className="whitespace-nowrap font-medium text-zinc-900">
                          {site.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-xs tabular-nums text-zinc-500">
                      {total}
                    </td>
                    {FIELDS.map((field, i) => {
                      const divider =
                        field.synced && !FIELDS[i - 1]?.synced
                          ? "border-l"
                          : undefined;
                      if (!applies(site.slug, field)) {
                        return (
                          <td
                            key={field.key}
                            className={cn("px-2 py-2.5", divider)}
                          >
                            <span
                              className="flex h-8 items-center justify-center rounded-md bg-zinc-50 text-[11px] text-zinc-400"
                              title={`${site.label} has no sync, so ${field.label} can never be populated. Not counted against it.`}
                            >
                              n/a
                            </span>
                          </td>
                        );
                      }
                      const p = pct(site.slug, field.key);
                      const style = cellClass(p);
                      const have = filled[site.slug]?.[field.key] ?? 0;
                      return (
                        <td
                          key={field.key}
                          className={cn("px-2 py-2.5", divider)}
                        >
                          <span
                            className={cn(
                              "flex h-8 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                              style.box,
                              style.text,
                            )}
                            title={`${site.label} / ${field.label}: ${have} of ${total} rows`}
                          >
                            {total === 0 ? "-" : `${Math.round(p)}%`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Where the work is. The matrix shows percentages, but effort is
              measured in ROWS, and the two rank differently: a website with
              345 rows at 70% is more work than one with 27 rows at 10%. ---- */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
            <h2 className="font-heading text-sm font-semibold text-zinc-900">
              Biggest gaps
            </h2>
            <span className="text-xs text-zinc-500">
              ranked by rows missing, not by percentage
            </span>
          </div>
          {gaps.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Every field is filled in on every row.
            </p>
          ) : (
            <ul className="divide-y">
              {gaps.map((gap) => (
                <li
                  key={`${gap.site.slug}-${gap.field.key}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span
                    aria-hidden
                    className="h-8 w-[3px] shrink-0 rounded-full"
                    style={{ backgroundColor: ACCENT[gap.site.slug] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-900">
                      {gap.site.label}
                      <span className="text-zinc-400"> / </span>
                      {gap.field.label}
                    </div>
                    <div className="mt-1 flex h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-100">
                      <span
                        className={cn("rounded-full", barClass(gap.pct))}
                        style={{ width: `${Math.min(100, gap.pct)}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-heading text-lg font-semibold leading-none tabular-nums text-zinc-900">
                      {gap.missing}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                      rows to fill
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
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
            Blank text counts as missing, so a Purpose containing only spaces is
            a gap. Multi-select fields count a row as covered once it has at
            least one selection, so six tags on one row is still one row.
          </p>
        </div>
      </div>

      <p className="pt-1 text-center text-xs text-zinc-400">
        Beta6 preview. Controls on this page are static, the live hub is at{" "}
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

/** Heatmap cell styling. Discrete steps rather than a smooth alpha ramp, so
 *  the cells land on the app's own palette and the text stays legible at both
 *  ends of the scale. */
function cellClass(p: number): { box: string; text: string } {
  if (p <= 0) return { box: "bg-zinc-100", text: "text-zinc-400" };
  if (p < 20) return { box: "bg-red-100", text: "text-red-800" };
  if (p < 45) return { box: "bg-amber-100", text: "text-amber-900" };
  if (p < 70) return { box: "bg-emerald-100", text: "text-emerald-900" };
  if (p < 99.5) return { box: "bg-emerald-300", text: "text-emerald-950" };
  return { box: "bg-emerald-600", text: "text-white" };
}

/** Same scale as the cells, for the thin progress bars. */
function barClass(p: number): string {
  if (p < 20) return "bg-red-400";
  if (p < 45) return "bg-amber-400";
  if (p < 70) return "bg-emerald-400";
  return "bg-emerald-600";
}

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
