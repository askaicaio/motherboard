// Automations "Housekeeping" page, reached from the FOURTH button in the Main
// Page toolbar strip.
//
// ⚠️⚠️ THE ROUTE IS STILL `/automations/housekeeping-alerts` AND THAT IS
// DELIBERATE. Only the LABEL changed (2026-09-18): "Alerts" was the weak half -
// nothing on this page alerts, it lists records nobody has finished typing, and
// the tab already uses "alerts" for Error History and Latest Errors, which are
// about automations that genuinely broke. **Reusing the word for "someone has
// not written a Purpose yet" made the real one quieter.**
// 📌 The folder, the component name and every `getHousekeeping*` identifier keep
// the old spelling so no link, bookmark or import breaks. **Do not rename the
// route to match the label** without a redirect.
//
// ⭐ THE ASK, 2026-09-03: "the page that shows what still needs to be manually
// evaluated." The RULE, given 2026-09-13: "these are the five columns that users
// are required to fill in. Automations show up in the housekeeping page when any
// of the following are true: Trigger Event, Automation Tags, and Evaluation
// containing 'None'. Purpose and Notes being blank."
// ⚠️ IT IS FOUR NOW: **Notes left the required set on 2026-09-21** and became
// optional supporting information. The quote above is kept as the original
// instruction; `housekeeping-rule.ts` carries the change and the reasoning.
//
// 📌 THE RULE LIVES IN `@/lib/automations/housekeeping-rule` and the reads in
// `@/lib/automations/housekeeping`. Both carry the reasoning; this file is just
// the shell.
//
// 🛑 THE FIRST VERSION OF THIS PAGE HAD THE WRONG RULE (an Evaluation-only
// queue, #532) and was rebuilt the same day. The why is written up in
// `housekeeping.ts`; the short version is that I inferred the contents from what
// the data could support instead of asking which columns were required.
//
// ⚠️ A LITERAL ROUTE SEGMENT, like `feature-integration`, so it takes precedence
// over the sibling `[platform]` dynamic route for this exact path.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAuth } from "@/lib/auth/guard";
import { HousekeepingAlertsClient } from "@/components/automations/housekeeping-alerts-client";
import {
  getHousekeepingChoices,
  getHousekeepingCoverage,
  getHousekeepingRows,
} from "@/lib/automations/housekeeping";
import { REQUIRED_COLUMNS } from "@/lib/automations/housekeeping-rule";

export const dynamic = "force-dynamic";

export default async function AutomationsHousekeepingAlertsPage() {
  await requireAuth();

  // ⚠️ SEE THE READ-BUDGET NOTE in `housekeeping.ts` before adding anything
  // here. These three together peak at FIVE concurrent reads against a `max: 10`
  // pool, and the margin is deliberate.
  // 📌 `getHousekeepingCoverage` is ONE query precisely so it can join this wave
  // without pushing the peak higher; it folds its junction count into an
  // `exists` rather than taking a second read. Its own note explains why.
  const [rows, choices, coverage] = await Promise.all([
    getHousekeepingRows(),
    getHousekeepingChoices(),
    getHousekeepingCoverage(),
  ]);

  return (
    /* ⭐⭐ THE PAGE KEEPS ITS WIDTH AND SCROLLS SIDEWAYS, 2026-09-22: "make the
       marked elements keep their size, add horizontal scrolling when the
       elements start going beyond the horizontal width of the browser."
       🛑 WHY THE SCROLLER IS HERE AND NOT ON `<main>`: the dashboard layout
       gives `<main>` **`overflow-x-clip`**, which cuts overflow off WITHOUT
       creating a scroll container - deliberately, so the window stays the
       scroller and `position: sticky` keeps working for page content. That is
       why this page simply got CUT at the window edge instead of scrolling.
       **Changing it would change every dashboard page**, so the scroller is
       scoped to this one.
       ⚠️ `min-w-[875px]` IS 827 + THE 48px OF `p-6`: 827 is the table card's
       own width (`TABLE_CARD_WIDTH`), which is also what the stacked coverage
       panel takes. **So the floor is the widest thing on the page**, and below
       it nothing reflows - the subtitle keeps its three sentence-lines, the
       filter chips keep one row, the panel keeps its bars - the page just
       scrolls.
       📌 IF THE TABLE CARD'S WIDTH EVER CHANGES, THIS NUMBER FOLLOWS IT. */
    <div className="overflow-x-auto">
      <div className="min-w-[875px] space-y-6 p-6">
        <Link
          href="/automations"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Automations
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Housekeeping
          </h1>
          {/* ⭐⭐ THE USER'S OWN WORDING, 2026-09-21, replacing the shorter
            version from three days earlier. Three sentences doing three jobs:
            why the row is here, what to DO about it (read the automation first,
            by following its link), and what to add beyond the minimum.
            📌 IT NAMES NO COLUMNS. That list was cut on 2026-09-18 because the
            names are already on screen twice, in the chips down each row and in
            the coverage panel.
            ⚠️ THE COUNT IS COMPUTED, NEVER TYPED. It printed 5 until Notes left
            the required set on 2026-09-21 and became the "other supporting
            information" this sentence asks for; it printed 4 the moment
            `REQUIRED_COLUMNS` lost an entry, with no edit here. */}
          {/* ⭐⭐ ONE SENTENCE PER LINE, 2026-09-22: "lets try each sentence being
            in its own line, 3 sentences so 3 lines total." **The three jobs the
            copy does now each own a row**: why the entry is listed, what to do
            about it, what to add beyond the minimum.
            📌 WHAT THIS REPLACED, because the numbers are worth keeping: the
            same text as ONE paragraph ran 269 characters across a 1264px box
            and set as a 1248px line plus a 410px stub. `max-w-3xl` +
            `text-balance` fixed the raggedness (3 even lines of ~570/558/525)
            but broke the sentences wherever they happened to fall, which is
            what this replaces. **A cap sets the BLOCK's width and balance sets
            the LINES'; neither can put a break where the MEANING changes.**
            📊 THE THREE SENTENCES MEASURE 521, 677 and 456px, so the 768px cap
            clears the longest by 91px and all three set on one line each. **The
            cap no longer decides the line breaks, the full stops do**; it is
            kept so that longer copy later gets a sane measure instead of the
            full 1264px.
            📌 `text-balance` STAYS for the narrow-window case: the middle
            sentence needs 677px, so below a ~965px window it has to wrap, and
            balance splits it evenly rather than leaving a stub. On a line that
            fits, it does nothing.
            ⚠️ SPANS INSIDE ONE `<p>`, NOT THREE PARAGRAPHS. It is one
            description; `block` gives each sentence its own line at the
            paragraph's own 20px line-height, so the block stays 60px tall and
            the list does not move. */}
          <p className="mt-1 max-w-3xl text-sm text-balance text-zinc-500">
            {/* ⚠️ "FIELDS", NOT "COLUMNS", SINCE 2026-09-23, at the user's
                request and in step with the coverage panel's new title,
                "Documentation of Required Fields". **The code constant stays
                `REQUIRED_COLUMNS`** - it names the Per Website table's columns,
                which is where these labels come from - so the word the reader
                sees and the word the code uses differ here on purpose. */}
            <span className="block">
              Automations that show up here are missing at least one of the{" "}
              {REQUIRED_COLUMNS.length} required fields.
            </span>
            <span className="block">
              Review the automation by clicking the link, then fill out the
              required information to clear the entry off the list.
            </span>
            <span className="block">
              Please add any other supporting information to the entry when
              possible.
            </span>
          </p>
        </div>

        <HousekeepingAlertsClient
          initialRows={rows}
          choices={choices}
          coverage={coverage}
        />
      </div>
    </div>
  );
}
