"use client";

// THE HOUSEKEEPING LIST, the interactive half of the page.
// The rule for what appears here lives in `@/lib/automations/housekeeping-rule`
// and the reads in `@/lib/automations/housekeeping`; read the rule first.
//
// ⭐⭐ CLICKING A ROW OPENS THE REAL EDIT DIALOG, the same `WorkflowDialog` the
// website tables use. That was the user's choice (2026-09-13) over inline
// editors, and it is the right one for a reason worth keeping: **two of the five
// required columns are free text and one is a multi-select, so "edit inline"
// would have meant rebuilding that dialog's inputs inside a list row.** 473 of
// the 526 rows need all five columns anyway, so a dialog per row is the natural
// unit of work, not a compromise.
//
// ⚠️ THE ROW LEAVES THE LIST WHEN IT NO LONGER QUALIFIES, decided by re-running
// the SHARED rule against the row the dialog hands back. **Not by assuming a
// save means done**: a save that fills three of five columns leaves the row
// here, with fewer chips, which is exactly right.
//
// 📌 NO OPTIMISTIC UPDATE HERE, unlike the version this replaced. The dialog
// does its own save and returns the saved row, so there is nothing to guess at
// and nothing to roll back.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Inbox } from "lucide-react";

import { ColorBadge } from "@/components/automations/color-badge";
import { WorkflowDialog } from "@/components/automations/workflow-dialog";
import type { AutomationRow } from "@/components/automations/automations-table-client";
import { AUTOMATION_SITES } from "@/lib/automations/sites";
import {
  REQUIRED_COLUMNS,
  missingRequired,
} from "@/lib/automations/housekeeping-rule";
import type { RequiredColumn } from "@/lib/automations/housekeeping-rule";
import type { HousekeepingRow } from "@/lib/automations/housekeeping";
import { cn } from "@/lib/utils";

interface ChoiceOption {
  id: string;
  value: string;
  badgeColor?: string | null;
  textColor?: string | null;
}

export interface HousekeepingChoices {
  authorChoices: ChoiceOption[];
  triggerEventChoices: ChoiceOption[];
  triageChoices: ChoiceOption[];
  automationTagChoices: ChoiceOption[];
  ghlTagChoices: ChoiceOption[];
  ghlFormChoices: ChoiceOption[];
  webhookChoices: ChoiceOption[];
}

/** How many rows the list renders before it stops.
 *
 *  ⚠️ THE FULL LIST IS 526 ROWS. Rendering all of them costs a visibly slow page
 *  for a list nobody scrolls to the bottom of, so it stops here and says so.
 *  **The website filter is the real answer**: the backlog is entirely n8n, GHL
 *  and GHL B2B, so picking one turns this into a list you can finish.
 *
 *  ⭐ THE CAP IS SAFE ONLY BECAUSE THE ROWS ARRIVE FEWEST-MISSING-FIRST. The 53
 *  rows that are two fields from done sort above the 473 untouched ones, so they
 *  are inside the first 100 and can never be the part that gets cut. **If the
 *  server's ordering ever changes, this cap starts hiding the most finishable
 *  work.** */
const LIST_LIMIT = 100;

/** The GHL websites, the only ones whose Edit dialog shows the GHL Tags and GHL
 *  Forms pickers. Passing those choices to a Make or n8n row would put two
 *  fields on the dialog that do not apply to it. */
const GHL_PLATFORMS = new Set(["ghl", "ghl-b2b"]);

export function HousekeepingAlertsClient({
  initialRows,
  choices,
}: {
  initialRows: HousekeepingRow[];
  choices: HousekeepingChoices;
}) {
  const [rows, setRows] = useState(initialRows);
  const [site, setSite] = useState<string | null>(null);
  const [editing, setEditing] = useState<HousekeepingRow | null>(null);

  const visible = useMemo(
    () => (site ? rows.filter((r) => r.platform === site) : rows),
    [rows, site],
  );

  /** Per-website counts, computed off the UNFILTERED rows so the numbers do not
   *  change as you filter. */
  const countsBySite = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.platform, (m.get(r.platform) ?? 0) + 1);
    return m;
  }, [rows]);

  /** What the one list actually renders, and whether it stopped early.
   *
   *  🛑 IT USED TO BE GROUPED into a section per "how many of the five are
   *  missing", each with its own header. **The user removed that** (2026-09-13):
   *  "categorizing them in separate windows in unecessary. remove these separate
   *  headers and place them all in just one window." **Do not reintroduce the
   *  section headers.**
   *  📌 THE ORDER THOSE SECTIONS PRODUCED IS KEPT, because it was a separate
   *  decision the user made earlier the same day ("Nearly done first"): the rows
   *  arrive from the server sorted by fewest-missing, then website, then name.
   *  **The grouping was the presentation; the ordering is the priority, and only
   *  the presentation was rejected.** Each row's red chips already say how much
   *  is left, which is what the headers were duplicating. */
  const { shown, capped } = useMemo(
    () => ({
      shown: visible.slice(0, LIST_LIMIT),
      capped: visible.length > LIST_LIMIT,
    }),
    [visible],
  );

  /** Re-run the shared rule against the row the dialog saved, and either drop
   *  it, or keep it with its chips updated.
   *
   *  ⚠️ THE SAVED FIELDS ARE COPIED ACROSS ONE BY ONE, NOT SPREAD. `AutomationRow`
   *  types its dates as `string | Date | null` because it crosses the wire, while
   *  the row this page built from the database has real `Date`s; spreading the
   *  one into the other widens the type and TypeScript rejects it. Naming the
   *  fields also documents exactly what the list re-renders from, which is the
   *  five rule inputs plus what a row displays. */
  const handleSaved = useCallback((saved: AutomationRow) => {
    setRows((rs) => {
      const missing = missingRequired(saved) as RequiredColumn[];
      if (missing.length === 0) return rs.filter((r) => r.id !== saved.id);
      return rs.map((r) =>
        r.id === saved.id
          ? {
              ...r,
              name: saved.name,
              status: saved.status,
              purpose: saved.purpose ?? null,
              notes: saved.notes ?? null,
              triggerEventChoiceId: saved.triggerEventChoiceId ?? null,
              triggerEvent: saved.triggerEvent ?? null,
              triageChoiceId: saved.triageChoiceId ?? null,
              triage: saved.triage ?? null,
              triageBadgeColor: saved.triageBadgeColor ?? null,
              triageTextColor: saved.triageTextColor ?? null,
              automationTags: saved.automationTags ?? [],
              missing,
            }
          : r,
      );
    });
    setEditing(null);
  }, []);

  return (
    <div className="space-y-4">
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

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg py-16 text-center ring-1 ring-foreground/10">
          <Inbox className="h-6 w-6 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-900">
            Nothing to fill in
          </p>
          <p className="text-xs text-zinc-500">
            Every automation here has all five required columns filled.
          </p>
        </div>
      ) : (
        // ⚠️ ONE CARD, NO HEADER STRIP. The count lives on the "All websites"
        // chip above and the page's subtitle says what the list is, so a header
        // here would be a third copy of the same two facts.
        <section className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <ul className="divide-y">
            {shown.map((row) => (
              <ListRow key={row.id} row={row} onEdit={() => setEditing(row)} />
            ))}
          </ul>
          {capped ? (
            <p className="border-t bg-zinc-50 px-3.5 py-2 text-xs text-zinc-500">
              Showing {shown.length} of {visible.length}. Filter by website to
              work through the rest.
            </p>
          ) : null}
        </section>
      )}

      {/* ⚠️ ONE DIALOG FOR THE WHOLE PAGE, keyed by the row's id so it remounts
          with fresh field state each time. Rendering one per row would mount
          hundreds of dialogs.
          ⚠️ NO `onDelete`: the dialog hides its delete button when the prop is
          absent, which is what we want here. This page is for FILLING IN rows,
          and deleting from a list you are working through is the kind of thing
          you do by accident. Delete still lives on the website tables. */}
      {editing ? (
        <WorkflowDialog
          key={editing.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          platform={editing.platform}
          existing={editing as AutomationRow}
          authorChoices={choices.authorChoices}
          triggerEventChoices={choices.triggerEventChoices}
          triageChoices={choices.triageChoices}
          automationTagChoices={choices.automationTagChoices}
          ghlTagChoices={
            GHL_PLATFORMS.has(editing.platform) ? choices.ghlTagChoices : []
          }
          ghlFormChoices={
            GHL_PLATFORMS.has(editing.platform) ? choices.ghlFormChoices : []
          }
          webhookChoices={choices.webhookChoices}
          onSaved={handleSaved}
        />
      ) : null}
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

function ListRow({
  row,
  onEdit,
}: {
  row: HousekeepingRow;
  onEdit: () => void;
}) {
  const site = AUTOMATION_SITES.find((s) => s.slug === row.platform);
  const missing = new Set<string>(row.missing);

  return (
    <li>
      {/* ⚠️ THE WHOLE ROW IS THE BUTTON, so the click target is the thing you
          are looking at. The link out to the website table sits on top of it
          with `relative z-10` and stops propagation; without that, clicking the
          link would also open the dialog behind it. */}
      <button
        type="button"
        onClick={onEdit}
        className="relative flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="w-5 shrink-0" title={site?.label ?? row.platform}>
          {site ? <SiteGlyph site={site} className="h-4 w-4" /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-zinc-900 [overflow-wrap:anywhere]">
              {row.name}
            </span>
            <Link
              href={`/automations/${row.platform}?q=${encodeURIComponent(row.name)}`}
              onClick={(e) => e.stopPropagation()}
              title="Open in the website table"
              className="relative z-10 shrink-0 text-zinc-300 transition-colors hover:text-zinc-600"
            >
              <ExternalLink className="h-3 w-3" />
            </Link>
          </span>

          {/* ⭐ THE CHIPS ARE THE POINT OF THE ROW: which of the five are still
              blank, in the table's own column order, so the list answers "what
              do I have to type" without opening anything. Filled ones are shown
              greyed rather than hidden, so the five always read as a set and a
              row's progress is visible at a glance. */}
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {REQUIRED_COLUMNS.map((col) => (
              <span
                key={col}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  missing.has(col)
                    ? "bg-red-50 text-red-600 ring-1 ring-red-200"
                    : "text-zinc-400",
                )}
              >
                {col}
              </span>
            ))}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-500">
          <span>{row.status === "active" ? "Active" : "Paused"}</span>
          {row.triage ? (
            <ColorBadge
              value={row.triage}
              badgeColor={row.triageBadgeColor}
              textColor={row.triageTextColor}
              truncate
            />
          ) : null}
        </span>
      </button>
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
