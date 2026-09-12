"use client";

// THE EVALUATION QUEUE, the interactive half of the Housekeeping Alerts page.
// See `@/lib/automations/housekeeping` for what belongs in the queue and why;
// this file is only about working through it.
//
// ⭐⭐ IT IS A QUEUE, NOT A REPORT, and that was the user's explicit choice
// (2026-09-13, "Set it on the page"): **picking an Evaluation here writes it
// immediately and the row leaves the list.** The alternative on the table was a
// list that linked out to each website's table, which would have cost a round
// trip per decision. 272 rows carry a question mark today, so the difference is
// between clearing them in one sitting and not clearing them.
//
// ⚠️⚠️ THE WRITE GOES THROUGH `PATCH /api/automations/[id]`, THE SAME ENDPOINT
// THE EDIT DIALOG USES. **Do not add a queue-specific write path.** That route
// already validates the choice belongs to the `triage` column and already sets
// `row_updated_at`, which is what keeps the "Row Update" column honest. A
// bespoke endpoint would have had to re-implement both and would drift.
//
// 📌 OPTIMISTIC, WITH A ROLLBACK. The row disappears on click and comes back if
// the request fails, because the queue's whole value is rhythm: 272 decisions is
// only tolerable if each one costs nothing. The failure message follows the
// app's 5-second auto-fade convention.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Inbox, Loader2 } from "lucide-react";

import { ColorBadge } from "@/components/automations/color-badge";
import { SingleChoiceCombobox } from "@/components/automations/single-choice-combobox";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import { TRIAGE_ORDER } from "@/lib/automations/dropdown-config";
import type {
  HousekeepingRow,
  QueueGroup,
} from "@/lib/automations/housekeeping";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  value: string;
  badgeColor: string | null;
  textColor: string | null;
}

/** The three sections, in the order a person should work them. See `QueueGroup`
 *  for what each one means; the copy here is what the page actually says. */
const SECTIONS: {
  group: QueueGroup;
  title: string;
  blurb: string;
}[] = [
  {
    group: "stuck",
    title: "Stuck",
    blurb: "Someone looked at these and could not decide.",
  },
  {
    group: "provisional",
    title: "Awaiting confirmation",
    blurb: "A tentative answer that still has a question mark on it.",
  },
  {
    group: "untouched",
    title: "Never evaluated",
    blurb: "Nobody has looked at these yet.",
  },
];

/** How many untouched rows render before the list stops.
 *
 *  ⚠️ ONLY THE LAST SECTION IS CAPPED, and only because it is the long tail:
 *  526 rows at build time against 12 stuck and 272 provisional. **The first two
 *  sections are never truncated** — they are the actual work, and hiding any of
 *  it would defeat the page. Use the website filter to cut the tail down; it is
 *  concentrated in three websites, so that works. */
const UNTOUCHED_LIMIT = 50;

export function HousekeepingAlertsClient({
  initialRows,
  options,
}: {
  initialRows: HousekeepingRow[];
  options: Option[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [site, setSite] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // The app's standing convention for transient inline errors.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  /** Options in lifecycle order rather than alphabetical, so the picker reads
   *  "To Remove ... Keep" the way the column does everywhere else. Anything not
   *  in `TRIAGE_ORDER` (a state added later on the Dropdown Configuration page)
   *  sorts after the known ones instead of vanishing. */
  const orderedOptions = useMemo(() => {
    const rank = (v: string) => {
      const i = (TRIAGE_ORDER as readonly string[]).indexOf(v);
      return i === -1 ? TRIAGE_ORDER.length : i;
    };
    return [...options].sort(
      (a, b) => rank(a.value) - rank(b.value) || a.value.localeCompare(b.value),
    );
  }, [options]);

  const visible = useMemo(
    () => (site ? rows.filter((r) => r.platform === site) : rows),
    [rows, site],
  );

  /** Per-website counts for the filter chips, computed off the UNFILTERED rows
   *  so the numbers do not change as you filter. */
  const countsBySite = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.platform, (m.get(r.platform) ?? 0) + 1);
    return m;
  }, [rows]);

  const setEvaluation = useCallback(
    async (row: HousekeepingRow, choiceId: string) => {
      const option = options.find((o) => o.id === choiceId);
      if (!option) return;

      setSaving((s) => new Set(s).add(row.id));
      // Optimistic: drop the row now. `rows` is the source of truth for both
      // the list and the counts, so removing it here updates everything.
      setRows((rs) => rs.filter((r) => r.id !== row.id));

      try {
        const res = await fetch(`/api/automations/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ triageChoiceId: choiceId }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        // Put it back exactly where it was. Sorting is by platform then name,
        // so re-inserting and re-sorting lands it in its original position.
        setRows((rs) =>
          [...rs, row].sort(
            (a, b) =>
              a.platform.localeCompare(b.platform) ||
              a.name.localeCompare(b.name),
          ),
        );
        setError(`Could not save "${row.name}". Nothing was changed.`);
      } finally {
        setSaving((s) => {
          const next = new Set(s);
          next.delete(row.id);
          return next;
        });
      }
    },
    [options],
  );

  return (
    <div className="space-y-4">
      {/* ⚠️ THE FILTER IS THE ONLY THING THAT MAKES THE TAIL USABLE. The queue is
          810 rows across five websites, but n8n and GHL B2B have never been
          evaluated AT ALL and GHL is mostly untouched, so picking one website
          turns an impossible list into a finishable one. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          label="All websites"
          count={rows.length}
          active={site === null}
          onClick={() => setSite(null)}
        />
        {AUTOMATION_SITES.map((s) => (
          <FilterChip
            key={s.slug}
            label={s.label}
            count={countsBySite.get(s.slug) ?? 0}
            active={site === s.slug}
            onClick={() => setSite(s.slug)}
          />
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200"
        >
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg py-16 text-center ring-1 ring-foreground/10">
          <Inbox className="h-6 w-6 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-900">Nothing waiting</p>
          <p className="text-xs text-zinc-500">
            Every automation here has an Evaluation.
          </p>
        </div>
      ) : (
        SECTIONS.map((section) => {
          const all = visible.filter((r) => r.group === section.group);
          if (all.length === 0) return null;
          const capped =
            section.group === "untouched" && all.length > UNTOUCHED_LIMIT;
          const shown = capped ? all.slice(0, UNTOUCHED_LIMIT) : all;

          return (
            <section
              key={section.group}
              className="overflow-hidden rounded-lg ring-1 ring-foreground/10"
            >
              <div className="flex items-baseline justify-between gap-3 border-b bg-zinc-50 px-3.5 py-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {section.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {section.blurb}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {capped
                    ? `showing ${shown.length} of ${all.length}`
                    : `${all.length}`}
                </span>
              </div>
              <ul className="divide-y">
                {shown.map((row) => (
                  <QueueRow
                    key={row.id}
                    row={row}
                    options={orderedOptions}
                    saving={saving.has(row.id)}
                    onPick={(choiceId) => setEvaluation(row, choiceId)}
                  />
                ))}
              </ul>
              {capped ? (
                <p className="border-t bg-zinc-50 px-3.5 py-2 text-xs text-zinc-500">
                  {all.length - shown.length} more. Filter by website to work
                  through them.
                </p>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-zinc-900 text-white"
          : "bg-card text-zinc-600 ring-1 ring-foreground/10 hover:bg-zinc-50 hover:text-zinc-900",
      )}
    >
      {label}
      <span
        className={cn(
          "tabular-nums",
          active ? "text-zinc-300" : "text-zinc-400",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function QueueRow({
  row,
  options,
  saving,
  onPick,
}: {
  row: HousekeepingRow;
  options: Option[];
  saving: boolean;
  onPick: (choiceId: string) => void;
}) {
  const site = AUTOMATION_SITES.find((s) => s.slug === row.platform);

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      {/* The website, as its own mark rather than a word: five glyphs down the
          left edge are scannable in a way five repeated labels are not. */}
      <span className="w-5 shrink-0" title={site?.label ?? row.platform}>
        {site ? <SiteGlyph site={site} className="h-4 w-4" /> : null}
      </span>

      <span className="min-w-0 flex-1">
        {/* ⚠️ LINKS TO THE WEBSITE TABLE WITH THIS ROW SEARCHED, the same
            `?q=` pattern the hub's panels use. It is an escape hatch for "I need
            the full record before I can decide", NOT the way to answer: the
            picker on the right is. */}
        <Link
          href={`/automations/${row.platform}?q=${encodeURIComponent(row.name)}`}
          className="group inline-flex items-center gap-1.5"
        >
          <span className="text-sm font-medium text-zinc-900 [overflow-wrap:anywhere] group-hover:underline">
            {row.name}
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
        </Link>
        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
          <span>{row.status === "active" ? "Active" : "Paused"}</span>
          {row.evaluation ? (
            <ColorBadge
              value={row.evaluation}
              badgeColor={row.badgeColor}
              textColor={row.textColor}
              truncate
            />
          ) : null}
        </span>
      </span>

      <span className="flex w-52 shrink-0 items-center gap-2">
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
        ) : null}
        {/* ⚠️ THE REUSED COMBOBOX, not a bespoke menu: the app has a documented
            dropdown standard and this is it. `side="left"` because the picker
            sits at the right edge of a full-width row. */}
        <span className="min-w-0 flex-1">
          <SingleChoiceCombobox
            options={options}
            value={row.evaluationChoiceId ?? ""}
            onChange={onPick}
            emptyLabel="Set Evaluation…"
            searchPlaceholder="Search Evaluation…"
            side="left"
          />
        </span>
      </span>
    </li>
  );
}

/** The website's own mark. **A local copy, like the hub's**: `SiteGlyph` has
 *  never been a shared component, and the two tinted logos need a CSS mask while
 *  the full-colour ones are plain images. */
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
