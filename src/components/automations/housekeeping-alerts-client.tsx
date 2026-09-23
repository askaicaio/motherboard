"use client";

// THE HOUSEKEEPING LIST, the interactive half of the page.
// The rule for what appears here lives in `@/lib/automations/housekeeping-rule`
// and the reads in `@/lib/automations/housekeeping`; read the rule first.
//
// ⭐⭐ CLICKING A ROW OPENS THE REAL EDIT DIALOG, the same `WorkflowDialog` the
// website tables use. That was the user's choice (2026-09-13) over inline
// editors, and it is the right one for a reason worth keeping: **one of the four
// required columns is free text and one is a multi-select, so "edit inline"
// would have meant rebuilding that dialog's inputs inside a list row.** 483 of
// the 536 rows need all four columns anyway, so a dialog per row is the natural
// unit of work, not a compromise.
//
// ⚠️ THE ROW LEAVES THE LIST WHEN IT NO LONGER QUALIFIES, decided by re-running
// the SHARED rule against the row the dialog hands back. **Not by assuming a
// save means done**: a save that fills three of four columns leaves the row
// here, with fewer chips, which is exactly right.
//
// 📌 NO OPTIMISTIC UPDATE HERE, unlike the version this replaced. The dialog
// does its own save and returns the saved row, so there is nothing to guess at
// and nothing to roll back.

import { useCallback, useState } from "react";
import { ExternalLink, Inbox } from "lucide-react";
import { toast } from "sonner";

import { confirmDialog } from "@/components/ui/confirm";
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
import type {
  HousekeepingCoverage,
  HousekeepingRow,
} from "@/lib/automations/housekeeping";
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
 *  ⭐ EACH IS SIZED TO ITS OWN LABEL rather than all four being equal, because
 *  "Automation Tags" is twice the width of "Purpose" and equal columns would
 *  leave the right-hand ones mostly empty. **The chips align on their left edge
 *  down each column**, which is the whole point of the restructure.
 *  🛑 THERE WERE FIVE UNTIL 2026-09-21. The 75px entry was Notes', and it went
 *  when Notes stopped being required. **THIS ARRAY IS INDEXED AGAINST
 *  `REQUIRED_COLUMNS`**, so the two lengths have to match or the last column
 *  renders without a width.
 *  ⚠️ THEY LIVE IN A `<colgroup>` AND THE TABLE IS `table-fixed`. Without
 *  `table-fixed` the browser sizes columns from their content, so one long
 *  automation name would shove the four chip columns out of alignment between
 *  one row and the next - which is the bug this layout exists to prevent. */
const COLUMN_WIDTHS = ["120px", "110px", "95px", "85px"] as const;

/** How wide the Name-and-link column is. **400px, TAKEN FROM THE PER WEBSITE
 *  TABLES**, where the Name cell is `w-[400px] min-w-[400px] max-w-[400px]`.
 *
 *  🛑 IT USED TO HAVE NO WIDTH AT ALL, so it absorbed every pixel the fixed
 *  columns left - 664px by the time the status column went. The user: "This
 *  section is too wide. pls check the reference again from the per website pages
 *  to see how it is made 'not so wide'." **The answer there is not a clever
 *  layout, it is simply a hard 400px**, and the URL truncating inside it is what
 *  keeps a row one line tall.
 *  ⚠️ THE NUMBER IS THE POINT, so do not "improve" it to a percentage or a
 *  `max-w`. It matches the website tables column-for-column, which is what makes
 *  the two pages read as the same app. */
const NAME_WIDTH = "400px";

/** How wide the table's column holds, in pixels.
 *
 *  ⭐⭐ THE FIVE COLUMNS ADD UP TO 810 (400 + 120 + 110 + 95 + 85). The card
 *  gets 827: **810 of columns, ~15 for the scroll window's own scrollbar, 2 for
 *  the card's border.** Anything left over lands in the trailing slack `<col>`,
 *  which is why that column still exists even though the table no longer
 *  stretches.
 *  📌 IT WAS 902 UNTIL 2026-09-21, when Notes left the required set and took its
 *  75px column with it. **The card shrank rather than the other columns
 *  growing**: each width is sized to its own label, so widening them would only
 *  put air between a chip and the next column.
 *
 *  🛑 IT IS FIXED SO THE TABLE STOPS EATING THE WHOLE ROW. Until 2026-09-17 the
 *  card was full width and the slack column swallowed ~264px of nothing: "we
 *  have this large empty spot here ... looks weird having it there." **The fix
 *  was not to widen a column** - it was to stop the table taking space it had no
 *  content for, and give that space to the coverage panels.
 *  ⚠️ SO A NEW COLUMN MEANS UPDATING THIS NUMBER TOO, or the slack column
 *  silently absorbs it and the panels never notice. */
const TABLE_CARD_WIDTH = 827;

export function HousekeepingAlertsClient({
  initialRows,
  choices,
  coverage,
}: {
  initialRows: HousekeepingRow[];
  choices: HousekeepingChoices;
  coverage: HousekeepingCoverage;
}) {
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<HousekeepingRow | null>(null);

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
   *  rule inputs plus what a row displays. */
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

  /** Delete the row the dialog is open on. **Lifted from the website table's
   *  `handleDelete`**, deliberately down to the wording.
   *
   *  ⭐⭐ THE USER ASKED FOR *THAT* BUTTON, NOT A DELETE BUTTON: "Check the Per
   *  Website page's edit/add workflow popup again. Add in the delete button from
   *  there that you missed." So the confirm title, the name-on-its-own-line body,
   *  the red "This cannot be undone.", the `destructive` flag, the endpoint and
   *  both toasts are the same. **A second, subtly different delete confirmation
   *  for the same destructive action is how a user learns not to trust either.**
   *
   *  ⚠️ ONE STEP OF THE WEBSITE TABLE'S VERSION IS NOT HERE, AND IT IS NOT AN
   *  OVERSIGHT: it finishes with `reconcileRows()`, a refetch of
   *  `/api/automations?platform=X`. **This list is not one platform and has no
   *  such endpoint** - its rule spans all five websites. The refetch existed to
   *  refresh other rows' SHARED-webhook counts, which this page shows only inside
   *  the dialog's picker labels, so the cost of skipping it is a count that can
   *  read one high until the next page load. 📌 If that ever matters, the fix is
   *  an endpoint for this page's rule, not a per-platform refetch.
   *
   *  📌 THE FILTER CHIP COUNTS FOLLOW FOR FREE because they are derived from
   *  `rows`. **The red pill on the hub's toolbar does NOT** - it is server-read
   *  per render, so it stays one high until you navigate back. */
  const handleDelete = useCallback(async (row: HousekeepingRow) => {
    const label = row.name || "This automation";
    if (
      !(await confirmDialog({
        title: "Delete Automation?",
        body: (
          <>
            {label}
            <br />
            <span className="text-red-600">This cannot be undone.</span>
          </>
        ),
        confirmLabel: "Delete",
        destructive: true,
      }))
    )
      return;
    const res = await fetch(`/api/automations/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setEditing(null);
    toast.success("Deleted");
  }, []);

  return (
    <div className="space-y-4">
      {/* 🛑 THE WEBSITE FILTER CHIPS WERE HERE AND WERE REMOVED 2026-09-24:
          "Remove these selectors. This feature is not needed." A row of
          `All websites 557 | Make 2 | n8n 179 | GHL 265 | GHL B2B 111 |
          Zapier 0` that filtered the list to one website.
          ⚠️ THE LIST IS NOW ALWAYS THE WHOLE ESTATE, which is what the
          website-first sort already assumed: rows are ordered by canonical
          website then name, so each website is a contiguous block you scroll
          to. **That ordering is what makes the filter redundant**; if the sort
          is ever changed, the case for a filter comes back.
          📌 The per-row website glyph in the Name cell stays and is now the
          only website marker on the page. */}
      {/* ⭐⭐ TABLE LEFT, COVERAGE PANELS RIGHT, 2026-09-17: "Shrink the table
          in S2 to remove this empty space, and put the statistic there."
          ⚠️ `items-start` MATTERS. Without it the panels column stretches to the
          table's height and the last panel floats away from the fourth; the
          panels are meant to stack from the top and stop. */}
      {/* ⭐⭐ TWO COLUMNS ONLY WHEN THEY FIT, 2026-09-22: "When the Browser
          Window gets smaller, this statistic becomes unreadable."
          📊 WHY IT BROKE, MEASURED: the table card is FIXED at 827px and
          `shrink-0`, so **every pixel the window loses comes out of the panel**.
          The panel's row carries ~280px of fixed content (label 112, percent 40,
          fraction 64, three 12px gaps, 28px padding), so the bar - the only
          flexible thing in it - is what pays. At a 1437px window the panel was
          258px: **bar 0px and the fraction clipped by the card's
          `overflow-hidden`.** 1500px still worked (bar 41px), 1300px was
          hopeless (panel 121px).
          ⭐ THE BREAKPOINT WAS MEASURED, NOT GUESSED, AND THE FIRST GUESS WAS
          WRONG. Everything but the panel is fixed, so **panel width = viewport
          - 1179** on this page, and the row spends 280 of it before the bar
          gets any. 1480 was tried first and put the two columns back with a
          **21px bar**; `2xl` (1536) leaves ~77px, which is the smallest bar
          worth calling a bar. Below that, stacking beats squeezing.
          📌 THE PANEL GOES ABOVE THE TABLE when stacked, not below: the list is
          viewport-tall, so a panel underneath it would sit below the fold and
          the statistic would effectively disappear on exactly the windows that
          triggered this fix. **Summary first, then the detail it summarises.**
          ⚠️ THE HUB'S COPY OF THIS PANEL NEEDS NONE OF THIS. That page splits
          its width fluidly instead of reserving a fixed table, so at 1437px its
          panel is 578px with a 298px bar. **This is a layout bug of THIS page,
          not of the panel.** */}
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start">
        <div className="shrink-0" style={{ width: TABLE_CARD_WIDTH }}>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg py-16 text-center ring-1 ring-foreground/10">
              <Inbox className="h-6 w-6 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-900">
                Nothing to fill in
              </p>
              <p className="text-xs text-zinc-500">
                Every automation here has all four required columns filled.
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
                {/* ⭐⭐ THE COLUMNS AND THEIR ORDER WERE SPECIFIED BY THE USER
                2026-09-15: "Do it this way, each number represents the columns
                from left to right. 1.) Name with Link below it 2.) Automation
                tags 3.) Trigger Event 4.) Evaluation 5.) Purpose 6.) Notes."
                ⚠️ THAT LIST HAD SIX AND THE TABLE NOW HAS FIVE: **the same user
                dropped Notes from the required set on 2026-09-21**, so its
                column went with it. The order of what remains is untouched.
                The rows were a stacked block before: name on one line, all the
                chips wrapped underneath it. **Nothing lined up between one row
                and the next**, which is what "the table structure is not good
                enough" meant.

                🛑 THERE IS NO `<thead>`, AND THAT IS A DECISION, NOT AN
                OMISSION. The user was asked and picked it. Every cell already
                prints its own column's name, so a header row would be a second
                copy of all four words - **the same argument that removed this
                page's section headers in #534.** The chips are the labels.
                ⚠️ SO DO NOT "FIX" THIS BY ADDING A HEADER ROW without also
                taking the words out of the cells, and that swap was offered and
                declined: "Keep the functionality of the Gray and red indicator
                you made, were just repositioning them." */}
                <table className="w-full table-fixed border-collapse text-sm">
                  <colgroup>
                    {/* Name + link, pinned to the website tables' own width. */}
                    <col style={{ width: NAME_WIDTH }} />
                    {COLUMN_WIDTHS.map((w, i) => (
                      <col key={REQUIRED_COLUMNS[i]} style={{ width: w }} />
                    ))}
                    {/* ⭐⭐ THE SLACK COLUMN, AND IT IS LOAD-BEARING. Every real
                    column now has a fixed width, and they add up to less than
                    the card. **`table-fixed` shares leftover space out across
                    the columns that have widths**, so without something to
                    absorb it the 400px would silently become ~500px and the fix
                    would undo itself.
                    📌 IT SITS LAST so the five columns stay ADJACENT, which is
                    how the website tables read: there every column is fixed and
                    the table overflows, so no gaps open up between them. Here
                    the spare width collects at the right edge instead of being
                    sprayed through the row.
                    ⚠️ It renders no cell. A `<col>` with no matching `<td>` is
                    fine - the column simply has no content in any row. */}
                    <col />
                    {/* 🛑 THE FIVE DATA COLUMNS ARE THE WHOLE LIST. There was a
                    SIXTH, Notes, until it stopped being required on 2026-09-21,
                    and a SEVENTH before that, Active / Paused. I kept it in #537 on the argument
                    that it pre-dated the restructure and sat outside the region
                    the user had marked up; **they removed it on 2026-09-15
                    ("Remove this column").**
                    ⚠️ SO THE COUNT IS NOT AN ACCIDENT - the user's numbered list
                    was exhaustive, and both extras that outlived it were cut:
                    the Evaluation colour badge in #537 and the status column.
                    **Do not re-add a status column, or any other "while we are
                    here" column, without being asked.** `row.status` is still
                    carried in state because the edit dialog needs it; it just
                    has nowhere on this page that renders it.
                    📌 THE ACTION COLUMN ABOVE IS NOT A BREACH OF THAT: it was
                    asked for by name, and it carries a CONTROL rather than any
                    of the row's data. */}
                  </colgroup>
                  {/* ⚠️ `divide-y`, NOT a `border-t` on every row. With no header
                  above it, a top border on the FIRST row draws a second line
                  immediately inside the card's own edge, which reads as a
                  rendering glitch rather than as a divider. */}
                  <tbody className="divide-y">
                    {rows.map((row) => (
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
        </div>

        {/* ⚠️ IT COUNTS THE WHOLE ESTATE, and always did. This used to be the
            interesting half of a sentence - there were website filter chips
            above and this panel deliberately ignored them - and **the chips were
            removed 2026-09-24, so the panel and the list now agree by default**.
            It is one figure about how documented the estate is, not a second
            view of the list. Its "all websites" hint is what still says so. */}
        <CoveragePanel coverage={coverage} />
      </div>

      {/* ⚠️ ONE DIALOG FOR THE WHOLE PAGE, keyed by the row's id so it remounts
          with fresh field state each time. Rendering one per row would mount
          hundreds of dialogs.

          🛑🛑 `onDelete` IS PASSED, AND THIS FILE USED TO ARGUE THE OPPOSITE.
          The original note here said the prop was left off ON PURPOSE - "this
          page is for FILLING IN rows, and deleting from a list you are working
          through is the kind of thing you do by accident". **The user overruled
          that on 2026-09-15**: "You missed a feature in the housekeeping page.
          the delete button ... Add in the delete button from there that you
          missed." ⚠️ **So do not take the button back out on the strength of that
          old reasoning** - it was considered and rejected.
          📌 AND THE WORRY IT WAS BUILT ON IS ALREADY HANDLED by the dialog
          itself: the button is icon-only, tucked at the FOOTER'S LEFT EDGE away
          from Save, and it opens a destructive confirm naming the row. You do
          not reach it by accident from this list any more than from the website
          tables.
          ⚠️ THE TERNARY IS THE WEBSITE TABLE'S EXACT SHAPE. `onDelete` must be
          UNDEFINED when nothing is being edited, because **the dialog decides
          whether to render the button from the prop's presence**
          (`isEdit && onDelete`), not from a disabled state.

          ⭐⭐ `flagMissingRequired` MAKES THIS THE ONLY CALLER THAT MARKS THE
          REQUIRED FIELDS, 2026-09-17: "in S1 it currently highlights which section is
          missing, but the edit popup in S2 doesn't highlight it. Make it so
          that in S2, the user can easily tell which section needs to be filled
          up."
          🛑 THE USER WAS ASKED WHETHER IT SHOULD APPLY TO EVERY EDIT POPUP AND
          CHOSE **ONLY THIS PAGE**, so the website tables and
          `/automations/all` deliberately leave it off. **Do not pass it from
          them without asking again** - the dialog is shared by four surfaces. */}
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
          onDelete={editing ? () => handleDelete(editing) : undefined}
          flagMissingRequired
        />
      ) : null}
    </div>
  );
}

/** "Documentation of Required Fields" for the whole estate, in the space the table
 *  gave back.
 *
 *  🛑 IT WAS FIVE PANELS, ONE PER WEBSITE, FOR ONE ROUND (#554). The user
 *  replaced them the same day: "seeing it now, the proportions are way too
 *  small. So instead, just make it one statistic that combines all the
 *  websites." **Five panels split the column five ways, so every bar, label and
 *  percentage was a fifth of the size it could be.** With one panel the row can
 *  be the hub's full shape.
 *
 *  ⭐⭐ EVERY SIZE HERE IS THE HUB'S, COPIED RATHER THAN CHOSEN, 2026-09-18:
 *  "This statistic is too large now, check the reference in the main page and
 *  try to copy its exact size." **`px-3.5 py-2`, `text-xs` label in `w-28`, an
 *  `h-1.5` bar, `w-10` percent, `w-16` counts at `text-[11px]`** - the same
 *  values as `CoverageByField` in `automations/page.tsx`.
 *  🛑 I SIZED IT UP ONCE (text-sm, py-4, h-2) on the theory that a panel alone in
 *  a tall column should be more generous than one stacked with siblings in a
 *  detail pane. **The user overruled it the same day.** So do not scale it again
 *  to "fill" the column: the leftover space below is known and accepted.
 *  ⭐ THE ROW IS THE HUB'S ROW, fraction included: label, bar, percent,
 *  filled-over-total. The five-panel version had to drop the fraction to a
 *  `title` because 263px could not hold it; one panel has the room.
 *  ⚠️ IF THE HUB'S PANEL IS RESTYLED, THIS IS THE OTHER PLACE IT LIVES. Only two
 *  things are deliberately different, and neither is a size: the hint reads "all
 *  websites" instead of "required columns" (this one sums the estate rather than
 *  scoping to one site), and the rows come from `REQUIRED_COLUMNS` instead of
 *  `COVERAGE_FIELDS`.
 *  📌 Rows map over `REQUIRED_COLUMNS`, so the order and the names match the
 *  table beside it and the hub's panel, with no third list to keep in step. */
function CoveragePanel({ coverage }: { coverage: HousekeepingCoverage }) {
  const { total, filled } = coverage;
  return (
    // ⚠️ `order-first` PUTS THIS ABOVE THE TABLE while the layout is stacked,
    // and `2xl:order-none` hands it back to DOM order once the two columns fit.
    // The reasoning is at the layout row in this file.
    // 📌 STACKED, IT TAKES THE TABLE'S OWN 827px rather than the full container
    // width: a four-row card stretched across 1100px reads as a banner, and
    // matching the card below it keeps the page's left edge and right edge
    // honest.
    <div className="order-first w-full max-w-[827px] min-w-0 2xl:order-none 2xl:max-w-none 2xl:flex-1">
      {/* ⚠️ The panel sizes to its content and stops. It does NOT stretch to the
          table's height - a five-row card spread over 700px puts ~140px between
          rows, which reads worse than the whitespace below it. */}
      <div className="min-w-0 overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3.5 py-2">
          <span className="text-xs font-semibold text-zinc-800">
            Documentation of Required Fields
          </span>
          {/* ⚠️ THIS HINT SURVIVED AND THE HUB'S DID NOT, 2026-09-23, by the
              user's instruction: "keep the 'All Websites' subheader".
              ⭐ The difference is what each hint ADDS. The hub's said "required
              columns", which the new title already says; this one says WHICH
              ESTATE the numbers cover - every website, not the one selected -
              and nothing else on the panel says that. **The two headers are no
              longer identical on purpose.** */}
          <span className="text-[10px] tracking-wider text-zinc-500 uppercase">
            all websites
          </span>
        </div>
        {total === 0 ? (
          // ⚠️ Handled rather than dividing by zero into five 0% bars, which
          // would read as a real measurement of an empty estate. Same shape as
          // the hub's empty state, icon included.
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <Inbox className="h-5 w-5 text-zinc-300" />
            <p className="text-xs text-zinc-500">No automations recorded.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {REQUIRED_COLUMNS.map((col) => {
              const n = filled[col] ?? 0;
              const pct = (n / total) * 100;
              return (
                <li key={col} className="flex items-center gap-3 px-3.5 py-2">
                  {/* ⭐ ZINC-900, NOT ZINC-700, SINCE 2026-09-22 (#567), to
                      match the automation names in the panel beside the hub's
                      copy. **Do not restore the lighter grey.**
                      🛑 12px IS RE-CHOSEN, NOT LEFT ALONE: this row was raised
                      to 14px in `w-32`/`w-12` (#566) and **reverted the same
                      day** (#568), colour kept. The hub's copy records what the
                      two columns would have to become if 14px is tried again.
                      🛑 THE HUB'S PANEL IS THE TWIN and the user has twice
                      chosen to move both, so this file and `automations/page.tsx`
                      have to agree. */}
                  <span className="w-28 shrink-0 truncate text-xs font-medium text-zinc-900">
                    {col}
                  </span>
                  <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <span
                      className={cn("rounded-full", barClass(pct))}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-900">
                    {Math.round(pct)}%
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
                    {n}/{total}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The coverage bar's colour ramp.
 *
 *  ⚠️ A LOCAL COPY OF THE LIVE HUB'S `barClass`, kept identical so the two
 *  panels grade the same. **If one changes, change both** - that is the user's
 *  explicit choice (asked 2026-09-18), not an assumption.
 *
 *  ⭐⭐ THREE STEPS AT 30 AND 70, SET BY THE USER 2026-09-18: "Remove the
 *  conditional for Emerald 400. Stretch the amber conditional to also fit in the
 *  conditional that got removed ... Under 30% / 30%-70% / 70% and above."
 *      **under 30%  -> red-400**      nobody has really started
 *      **30% to 70% -> amber-400**    in progress
 *      **70% and up -> emerald-600**  done enough
 *  🛑 IT WAS FOUR STEPS AT 20/45/70 (red, amber, emerald-400, emerald-600),
 *  inherited from Alpha6 and never chosen for this app. **emerald-400 is gone and
 *  amber absorbed its band**, which is why the middle step is now much wider than
 *  the other two.
 *  ⚠️ NOT A GRADIENT, AND STILL FOR THE SAME REASON: a glance should sort rows
 *  into "nobody has touched this", "in progress" and "done", which a continuous
 *  scale cannot do. **Three steps says that more plainly than four did** - the old
 *  pair of greens split "done" in two for no stated reason. */
function barClass(p: number): string {
  if (p < 30) return "bg-red-400";
  if (p < 70) return "bg-amber-400";
  return "bg-emerald-600";
}

// ---------------------------------------------------------------------------
// 📌 HOW "OPEN BOTH" ENDED UP ON THE LINK, because the route matters more than
// the two lines it took.
//
// It shipped three ways in three days. A click ANYWHERE on the row did both
// (#538); the user confined that to a dedicated leftmost icon BUTTON (#545);
// **that button was parked because no icon reads as "opens two things"** (#546)
// - nine candidates were drawn at their real 16px and none carried it, and the
// one in use was a near-duplicate of the blue link icon in the same row. The
// user then picked the option that needs no icon at all (2026-09-17): put it on
// the URL link, which is already the thing you would click to see the
// automation.
//
// ⭐⭐ THE LESSON WORTH KEEPING: the button version needed a synthetic anchor,
// a `document.body` append, a `stopPropagation` guard and a `window.open`
// popup-vs-tab caveat. **The link version needs NONE of it**, because a real
// `<a target="_blank">` already opens tabs reliably and its click already
// bubbles. When a behaviour needs that much machinery, check whether an element
// that does it natively is already sitting in the row.
//
// ⚠️ THE ONE CONSTRAINT THAT SURVIVES ALL THREE VERSIONS: **the new tab takes
// focus and no page code can change that.** Foreground vs background is the
// browser's call, decided by HOW the link was activated. Dispatching a click
// with ctrl/cmd was tried (#543) and Chrome ignores a modifier on a SYNTHETIC
// click (#544). **Ctrl/cmd + clicking this link is a real gesture and does
// background the tab**, and it still opens the dialog.
// ---------------------------------------------------------------------------

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
    // 🛑🛑 THE ROW OPENS THE DIALOG AND NOTHING ELSE. For one day (#538) a click
    // ANYWHERE on the row also opened the automation in a new tab, and **the
    // user took that off** (2026-09-16): "Instead of it happening when clicking
    // anywhere on the entry, make it so it only happens when a specific button
    // is clicked." **Do not put the tab back on this handler.**
    // ⚠️ WHERE IT SETTLED, after a leftmost icon button was tried and parked:
    //     the URL LINK           -> new tab **and** dialog  (the dual action)
    //     the ROW anywhere else  -> dialog only
    // 📌 The link half is not a handler, it is the anchor's default action plus
    // this one bubbling up. See the anchor's own note.
    <tr
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      tabIndex={0}
      role="button"
      className="cursor-pointer transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none"
    >
      {/* ---- Name, with the automation's own link beneath it. ----
          ⭐ LIFTED FROM THE PER WEBSITE TABLES' NAME CELL, not invented here:
          name on top, the URL below it in blue with an icon, truncated on ONE
          line. **The ellipsis is on the LEFT (`[direction:rtl] text-left`) so
          the END of the URL stays visible**, which is the half carrying the
          scenario or workflow id. `min-w-0` is what lets it shrink far enough
          for the ellipsis to engage inside the fixed column.
          📌 THE WEBSITE GLYPH RIDES IN THIS CELL rather than owning a column of
          its own. It is the row's identity, not one of the five. ⚠️ Its old
          justification was that it "only earns its space on the All websites
          view anyway"; **the website filter chips went on 2026-09-24, so every
          view is that view** and the glyph is now the page's only website
          marker. It earns the cell more than it did, not less. */}
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
              // ⭐⭐ THIS LINK IS THE DUAL ACTION, 2026-09-17: "number 4 sounds
              // good. So the URL will now be the dual action. and the simply
              // clicking the entry will just open the edit dialog instead."
              //
              // 🛑 THE MECHANISM IS AN ABSENCE. There is no handler here: the
              // anchor's OWN default action opens the tab, and the click then
              // BUBBLES to the row, whose handler opens the dialog. **Adding
              // `stopPropagation` back is what would break it**, which is exactly
              // what this line used to be.
              // ⚠️ SO DO NOT "TIDY" THIS BY GIVING THE ANCHOR AN onClick. The
              // page went the other way first: a leftmost icon BUTTON did both
              // (#545) and was parked (#546) because no icon reads as "opens two
              // things". **The link carries it precisely because it needs no icon
              // and no code** - the URL is already the thing you would click to
              // see the automation.
              // 📌 AND IT NEEDS NONE OF THE SYNTHETIC-ANCHOR MACHINERY a button
              // needed: no `document.createElement`, no `window.open` popup-vs-tab
              // question, nothing to append or remove. A real link was always the
              // reliable way to open a tab; this just stops hiding it.
              // 📌 It stays a real `<a href>`, which is also what keeps
              // middle-click, "copy link address" and the browser's own
              // status-bar preview working. ⚠️ Middle-click opens only the tab,
              // because browsers fire `auxclick` for it and React's `onClick`
              // never sees that; ctrl/cmd + click opens a BACKGROUND tab and the
              // dialog, which is the only way to get the tab off-focus at all.
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

      {/* ---- 2-5. One column per required column, in `REQUIRED_COLUMNS`
          order, which is the order the user gave and the order the website
          tables use.
          ⭐ AMBER WHEN THE COLUMN IS BLANK, plain grey when it is filled.
          📌 IT WAS RED UNTIL 2026-09-17: "The yellow you chose is good. give the
          same color scheme to these indicators instead of the current red they
          are using." **The yellow being matched is the `bg-amber-100` the edit
          dialog now paints behind an unfilled required field**, so a row and the
          dialog you open from it say the same thing in the same colour.
          ⚠️ `text-amber-800` IS THE APP'S EXISTING AMBER-CHIP TEXT, not a new
          pick - the live hub and Beta3 already use it for their "warn" tone.
          **The shape of the chip did not change**, only its hue: the earlier
          instruction still stands, "Keep the functionality of the Gray and red
          indicator you made, were just repositioning them."
          📌 FILLED ONES STAY VISIBLE IN GREY rather than being blanked out, so
          the four always read as a set and a row's progress is legible. An empty
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
                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                : "text-zinc-400",
            )}
          >
            {col}
          </span>
        </td>
      ))}
    </tr>
  );
}

/** The website's own mark. **A local copy, like the hub's**: `SiteGlyph` has
 *  never been a shared component, and the two tinted logos need a CSS mask while
 *  the full-colour ones are plain images.
 *
 *  🛑🛑 THE MASKED BRANCH MUST CARRY A DISPLAY UTILITY. `<span>` is
 *  `display: inline` by default, and **width and height DO NOTHING on a
 *  non-replaced inline element** - so `h-4 w-4` computes to 16px, the box
 *  measures 0x0, and the icon silently does not exist. Fixed 2026-09-15 after
 *  the user reported "Some items don't have the logo to the left side of their
 *  entry": **Make and n8n were invisible on every row while GHL, GHL B2B and
 *  Zapier were fine.**
 *  ⭐ THAT SPLIT IS THE TELL, and it is worth recognising: the full-colour sites
 *  render through `<img>`, **which Tailwind's preflight already sets to
 *  `display: block`**. Only the two masked spans were affected, so the bug looks
 *  like "some rows have no logo" rather than "the glyph is broken".
 *  ⚠️ THE OTHER COPIES OF `SiteGlyph` DO NOT NEED THIS AND ARE NOT WRONG: they
 *  sit as DIRECT FLEX CHILDREN, and a flex item is blockified by the layout
 *  itself. **This one is wrapped in a titled `<span>`, so nothing blockifies
 *  it.** That is exactly why the same component works elsewhere and failed here,
 *  and why the fix belongs on the glyph rather than on the wrapper - a glyph
 *  should not depend on what its parent happens to be. */
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
        // `block` and not `inline-block`: an inline-block sits on a text
        // baseline, which adds a few pixels of descender space under it inside
        // the wrapper. `block` gives exactly the 16x16 the classes ask for.
        className={cn("block shrink-0", className)}
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
