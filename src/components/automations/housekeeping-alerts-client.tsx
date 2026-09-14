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
import { ExternalLink, Inbox } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useFitViewportHeight } from "@/lib/automations/use-fit-viewport-height";
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

/** The GHL websites, the only ones whose Edit dialog shows the GHL Tags and GHL
 *  Forms pickers. Passing those choices to a Make or n8n row would put two
 *  fields on the dialog that do not apply to it. */
const GHL_PLATFORMS = new Set(["ghl", "ghl-b2b"]);

/** One fixed width per required column, in `REQUIRED_COLUMNS` order.
 *
 *  ⭐ EACH IS SIZED TO ITS OWN LABEL rather than all five being equal, because
 *  "Automation Tags" is three times the width of "Notes" and equal columns would
 *  leave the right-hand ones mostly empty. **The chips align on their left edge
 *  down each column**, which is the whole point of the restructure.
 *  ⚠️ THEY LIVE IN A `<colgroup>` AND THE TABLE IS `table-fixed`. Without
 *  `table-fixed` the browser sizes columns from their content, so one long
 *  automation name would shove the five chip columns out of alignment between
 *  one row and the next - which is the bug this layout exists to prevent. */
const COLUMN_WIDTHS = ["120px", "110px", "95px", "85px", "75px"] as const;

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

  /** The scroll window's measured height. Same hook the four Automations
   *  tables use, so this list caps itself the same way they do. */
  const { ref: scrollRef, style: scrollStyle } = useFitViewportHeight();

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
        // ⭐⭐ A BOUNDED SCROLL WINDOW, THE SAME ONE THE PER WEBSITE TABLES USE,
        // 2026-09-13: "I want the table in Housekeeping to have the same width
        // limits, and scrolling feature. Displaying everything in a tall window
        // isnt the way to go. We should be displaying everything in a small
        // window that has a scroll bar."
        //
        // ⚠️ THE PATTERN IS COPIED EXACTLY, not approximated: a `Card` whose
        // `CardContent` is the scroll area, `max-h-[70vh] overflow-auto p-0`,
        // with `useFitViewportHeight` overriding that max-height once measured.
        // **The class is the pre-measurement fallback and the inline style is the
        // real cap**; dropping either one breaks a different case (first paint
        // vs. a container that starts far down the page). That hook's own file
        // explains why a plain `max-h-[70vh]` is not enough here.
        //
        // 📌 NO ROW CAP ANY MORE. It used to render the first 100 with a
        // "showing 100 of 526" footer, which existed ONLY because the page grew
        // to 6432px otherwise. **The window solves that properly**, so all 526
        // render and you scroll them. The tables next door carry 344 rows of 20
        // columns this way, so this is well inside what the pattern handles.
        // ⚠️ ONE CONSEQUENCE WORTH KNOWING: the cap used to depend on the
        // fewest-missing-first ordering to avoid hiding the finishable rows.
        // **Nothing is hidden now, so that dependency is gone** - the ordering
        // is still there, but it is a convenience rather than a correctness
        // requirement.
        <Card>
          <CardContent
            ref={scrollRef}
            style={scrollStyle}
            className="max-h-[70vh] overflow-auto p-0"
          >
            {/* ⭐⭐ SIX COLUMNS, SPECIFIED BY THE USER 2026-09-15: "Do it this
                way, each number represents the columns from left to right.
                1.) Name with Link below it 2.) Automation tags 3.) Trigger
                Event 4.) Evaluation 5.) Purpose 6.) Notes."
                The rows were a stacked block before: name on one line, all five
                chips wrapped underneath it. **Nothing lined up between one row
                and the next**, which is what "the table structure is not good
                enough" meant.

                🛑 THERE IS NO `<thead>`, AND THAT IS A DECISION, NOT AN
                OMISSION. The user was asked and picked it. Every cell already
                prints its own column's name, so a header row would be a second
                copy of all five words - **the same argument that removed this
                page's section headers in #534.** The chips are the labels.
                ⚠️ SO DO NOT "FIX" THIS BY ADDING A HEADER ROW without also
                taking the words out of the cells, and that swap was offered and
                declined: "Keep the functionality of the Gray and red indicator
                you made, were just repositioning them." */}
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                {/* Name + link. No width, so it absorbs whatever the fixed
                    columns leave; it is the only cell that can use the room. */}
                <col />
                {COLUMN_WIDTHS.map((w, i) => (
                  <col key={REQUIRED_COLUMNS[i]} style={{ width: w }} />
                ))}
                {/* Active / Paused. ⚠️ A SEVENTH COLUMN, AND THE USER'S LIST HAS
                    SIX. It is kept because it was already on the row, sat
                    OUTSIDE the region they marked up, and says something none of
                    the five do. **The Evaluation colour badge that used to sit
                    beside it is gone**: that was the Evaluation column's own
                    value rendered at the opposite end of the row, which is
                    exactly the disorder this change is undoing. */}
                <col style={{ width: "76px" }} />
              </colgroup>
              {/* ⚠️ `divide-y`, NOT a `border-t` on every row. With no header
                  above it, a top border on the FIRST row draws a second line
                  immediately inside the card's own edge, which reads as a
                  rendering glitch rather than as a divider. */}
              <tbody className="divide-y">
                {visible.map((row) => (
                  <ListRow
                    key={row.id}
                    row={row}
                    onEdit={() => setEditing(row)}
                  />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
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

/** Open the automation on its own platform, UNLESS the click already did.
 *
 *  ⚠️ `from` IS THE CLICK'S TARGET, or `null` for a keyboard activation. If it
 *  sits inside the row's `<a>`, the browser is ALREADY opening the tab as that
 *  anchor's default action, and opening one here too would give you TWO.
 *
 *  🛑🛑 IT CLICKS A SYNTHETIC ANCHOR RATHER THAN CALLING `window.open`, AND THE
 *  REASON IS NOT STYLE. **`window.open(url, "_blank", features)` can open a
 *  POPUP WINDOW instead of a tab** - browsers decide from the feature string, and
 *  the exact rule for which tokens are "safe" varies. Then the row click and the
 *  link click would land in visibly different kinds of window, which is the
 *  opposite of the thing being asked for: **"clicking either of the two now does
 *  both actions at the same time."** An `<a target="_blank">` click is the same
 *  code path the real link takes, so the two cannot diverge.
 *  📌 `rel` carries `noopener` so the new tab gets no live handle back into this
 *  app, matching what a well-formed link would do.
 *  ⚠️ IT IS APPENDED TO THE DOCUMENT BEFORE CLICKING. A detached anchor's
 *  `.click()` is not reliably honoured, and this runs once per click so the cost
 *  is nothing. It is removed again immediately.
 *  📌 The synthetic anchor lives OUTSIDE the row, so its click cannot bubble back
 *  into the row handler and re-enter this. */
function openBoth(url: string | null, from: EventTarget | null) {
  if (!url) return;
  if (from instanceof Element && from.closest("a")) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
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
    // ⚠️ THE WHOLE ROW OPENS THE DIALOG, so the click target is the thing you
    // are looking at. It was a `<button>` wrapping a `<li>` until the table
    // landed; a button cannot wrap a `<tr>`, so the handler moved onto the row.
    // 📌 `tabIndex` AND THE KEY HANDLER ARE NOT DECORATION - they are what the
    // `<button>` used to give for free. **Dropping them makes every row in this
    // list unreachable without a mouse.** The website tables' rows have the same
    // gap; this one is not going to inherit it.
    //
    // ⭐⭐ ONE CLICK DOES BOTH THINGS, 2026-09-15: "clicking a cell and clicking
    // the automation link are two separate actions. make it so that clicking
    // either of the two now does both actions at the same time." **Either target
    // opens the automation on its platform AND opens the edit dialog here.** The
    // workflow this serves is obvious once stated: you cannot document an
    // automation you cannot see, so you always wanted both.
    //
    // 🛑🛑 THE LINK NO LONGER STOPS PROPAGATION, AND THAT IS THE WHOLE
    // MECHANISM. A click on the anchor now runs its own default action (the new
    // tab) and then BUBBLES to this handler (the dialog), so the anchor needs no
    // code at all for the dialog half.
    // ⚠️⚠️ WHICH CREATES THE ONE TRAP IN HERE: this handler must NOT open the
    // URL again when the click came from the anchor, or a link click yields TWO
    // tabs. `closest("a")` on the event target is the guard. **Remove it and the
    // duplicate only shows up when you click the link itself**, not the row, so
    // it is easy to miss.
    <tr
      onClick={(e) => {
        openBoth(row.externalUrl, e.target);
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          // 📌 Keyboard activation has no anchor to have come from, so it
          // always opens the URL itself. A keydown is still a user gesture, so
          // the synthetic anchor click is not treated as an unsolicited popup.
          openBoth(row.externalUrl, null);
          onEdit();
        }
      }}
      tabIndex={0}
      role="button"
      className="cursor-pointer transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none"
    >
      {/* ---- 1. Name, with the automation's own link beneath it. ----
          ⭐ LIFTED FROM THE PER WEBSITE TABLES' NAME CELL, not invented here:
          name on top, the URL below it in blue with an icon, truncated on ONE
          line. **The ellipsis is on the LEFT (`[direction:rtl] text-left`) so
          the END of the URL stays visible**, which is the half carrying the
          scenario or workflow id. `min-w-0` is what lets it shrink far enough
          for the ellipsis to engage inside the fixed column.
          📌 THE WEBSITE GLYPH RIDES IN THIS CELL rather than owning a column of
          its own. It is the row's identity, not one of the six, and it only
          earns its space on the "All websites" view anyway. */}
      <td className="px-3.5 py-2.5 align-top">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 w-4 shrink-0"
            title={site?.label ?? row.platform}
          >
            {site ? <SiteGlyph site={site} className="h-4 w-4" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-zinc-900 [overflow-wrap:anywhere]">
              {row.name}
            </div>
            {row.externalUrl ? (
              // ⚠️ NO `stopPropagation` - SEE THE ROW HANDLER. The click is
              // MEANT to reach the row so the dialog opens too. It stays a real
              // `<a href>` rather than becoming a span the row handles, because
              // that is what keeps middle-click, "copy link address" and the
              // browser's own status-bar preview working.
              <a
                href={row.externalUrl}
                target="_blank"
                rel="noreferrer"
                title={row.externalUrl}
                className="mt-0.5 flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate [direction:rtl] text-left">
                  {row.externalUrl}
                </span>
              </a>
            ) : null}
          </div>
        </div>
      </td>

      {/* ---- 2-6. One column per required column, in `REQUIRED_COLUMNS`
          order, which is the order the user gave and the order the website
          tables use.
          ⭐ THE CHIP IS UNCHANGED FROM THE STACKED LAYOUT - red with a ring when
          the column is blank, plain grey when it is filled. That was the
          instruction: "Keep the functionality of the Gray and red indicator you
          made, were just repositioning them."
          📌 FILLED ONES STAY VISIBLE IN GREY rather than being blanked out, so
          the five always read as a set and a row's progress is legible. An empty
          cell would be ambiguous between "done" and "not applicable".
          ⚠️ `whitespace-nowrap` MATTERS: the columns are sized to their own
          labels with very little slack, so "Automation Tags" would wrap to two
          lines and make that row taller than its neighbours. */}
      {REQUIRED_COLUMNS.map((col) => (
        <td key={col} className="px-2 py-2.5 align-top">
          <span
            className={cn(
              "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
              missing.has(col)
                ? "bg-red-50 text-red-600 ring-1 ring-red-200"
                : "text-zinc-400",
            )}
          >
            {col}
          </span>
        </td>
      ))}

      <td className="px-3.5 py-2.5 text-right align-top text-[11px] text-zinc-500">
        {row.status === "active" ? "Active" : "Paused"}
      </td>
    </tr>
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
