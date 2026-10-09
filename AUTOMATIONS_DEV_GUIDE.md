# Automations Tab: Developer and Maintenance Guide

Everything you need to work on the Automations tab without rediscovering it. The
feature brief (`AUTOMATIONS_FEATURE_BRIEF.md`) says what the tab is _for_; this
says how it is _built_, what the conventions are, and which things will bite you.

> **Why this file exists.** For most of this tab's life, every convention and
> decision lived only in one AI assistant's private memory. A human dev or a
> fresh AI opening this repo would have found a thin `AGENTS.md` and a stale
> `README.md` and nothing else. This is that knowledge, written down.
>
> **Keep it true.** It is not generated. If you change a convention, change it
> here in the same PR. A guide that is 80% right is worse than none, because
> people stop checking the code.

---

## 1. Orientation

The Automations tab inventories the automations ("workflows", "scenarios",
"Zaps") that live in five external platforms, and pulls back whatever each
platform's API will give.

**Five websites**, slugs are load-bearing and appear in routes, the database and
the sync code:

| slug      | label   | what it holds                     |
| --------- | ------- | --------------------------------- |
| `make`    | Make    | Scenarios                         |
| `n8n`     | n8n     | Workflows                         |
| `ghl`     | GHL     | GoHighLevel workflows             |
| `ghl-b2b` | GHL B2B | The second GoHighLevel subaccount |
| `zapier`  | Zapier  | Zaps                              |

**Routes** (all under `src/app/(dashboard)/automations/`):

| route                              | what it is                                              |
| ---------------------------------- | ------------------------------------------------------- |
| `/automations`                     | the hub: a card or rail per website                     |
| `/automations/[platform]`          | the Per Website Page, the main table                    |
| `/automations/[platform]/errors`   | Error History for one website                           |
| `/automations/all`                 | View All Lists: every website in one read-only table    |
| `/automations/dropdown-config`     | manages the choice lists behind the dropdown columns    |
| `/automations/feature-integration` | documents which capabilities each website's API unlocks |
| `/automations/design-versions`     | the directory of parallel design experiments            |
| `/automations/housekeeping-alerts` | Housekeeping: the worklist of under-documented rows     |

> ⚠️ **The Housekeeping page's route and its label disagree, on purpose.** The
> page is called **Housekeeping**; the route is still `housekeeping-alerts` and
> every `getHousekeeping*` identifier keeps the old spelling. Only the label
> changed (2026-09-18): nothing on that page alerts, and the tab already uses
> "alerts" for Error History and Latest Errors, which are about automations
> that genuinely broke. Do not rename the route to match without a redirect.

`feature-integration`, `all`, `dropdown-config`, `design-versions` and
`housekeeping-alerts` are **literal route segments that shadow the sibling
`[platform]` dynamic route**. If you add another literal segment under
`/automations/`, it wins over `[platform]` for that exact path. If you _delete_
one, the path falls through to `[platform]`, which calls `notFound()` for an
unknown slug. That is a tidy failure, but it is a fall-through, not a 404 route.

---

## 2. Architecture

### One dynamic route, one client component

The five Per Website Pages are **not** five pages. They are one dynamic route
(`[platform]/page.tsx`) rendering one client component
(`src/components/automations/automations-table-client.tsx`). A change to the
table is a change to all five at once. That is the main thing to internalise
before editing anything in there.

**View All Lists is deliberately a separate component**
(`all-automations-table-client.tsx`). It mirrors the Per Website table minus the
toolbar and editing, plus a "Website" column, and it is **allowed to diverge**.

> 🔻 **Standing rule:** whenever you add a column or feature to the Per Website
> Page, **ask whether it should also go on View All Lists.** Do not assume
> either way, and do not carry a previous answer forward.

### The single source of truth for websites

`src/lib/automations/sites.ts` holds `AUTOMATION_SITES` (slug, label,
description, icon, brand colour) plus two capability sets:

- `SYNCABLE_PLATFORMS`: the "Refresh List" button performs a real sync.
  Currently `make`, `n8n`, `ghl`, `ghl-b2b`. Zapier is not and never will be.
- `ERROR_CAPTURE_PLATFORMS`: error capture is wired. Currently `make`, `n8n`.

Add a slug to a set as that capability lands. Anything not in a set gets a
deliberate placeholder error rather than silence.

> ⚠️ **A website's `label` and `description` are rendered by roughly sixteen
> surfaces** (the hub, every bench page, the Per Website page, Error History,
> the Website column on View All Lists, the Feature Integration table, the
> related-automations dialog). Before editing one, **ask whether the change is
> meant for every screen or just the one you are looking at**, in plain words.
> The slug is a different matter entirely: it is the platform key in the
> database, in every route and in the sync code, and it must not change.

### The sync layer

Per platform, two files in `src/lib/integrations/`:

- `<platform>-client.ts`: talks to the API. **Owns the canonical URL builder**
  (`scenarioUrl()`, `workflowUrl()`, `ghlWorkflowUrl()`). Everything that writes
  an automation's link must go through these, or imports and syncs will
  duplicate each other's rows.
- `<platform>-sync.ts`: maps the API response onto our rows and upserts.

Two triggers:

1. **"Refresh List"**, a manual button, via `POST /api/automations/sync`.
2. **A 24 hour auto-refresh**, driven by the Vercel cron at
   `/api/cron/sync-automations` (scheduled every 5 minutes in `vercel.json`; the
   route decides whether anything is due). The toggle state lives in
   `app_settings`, not in a new table.

> 🛑 **A sync must never wipe a filled value with a blank.** If the API omits a
> field, leave what is stored. This rule is mirrored by the CSV importer, and
> breaking it silently destroys hand-entered data.

### One way to load rows, no exceptions

> 🛑 **Every code path that hands rows to the Per Website table goes through
> `getPerWebsiteRows()` in `src/lib/automations/per-website-rows.ts`. One
> query, no exceptions.** Full write-up in `docs/per-website-row-loading.md`.

This has its own document because breaking it caused an incident that **looked
exactly like destructive data loss and was not**. Clicking Refresh List blanked
most of a table: Author, Automation Tags, Trigger Event, Notes, GHL Tags, GHL
Forms, Webhook Links and Last Error all went empty, while Name, Status, Purpose,
Last Edited and Last Runtime survived. A reload restored everything, and a
direct database check confirmed nothing had been lost.

The cause was three code paths loading rows with three different queries: the
page's rich query with joins, the sync route's seven-column getters, and a plain
base-table select on the list endpoint. The client replaced its state with a
thinner shape, so columns the query never asked for rendered blank.

**Recognise the symptom:** some columns blank after an action, a reload fixes
it, the data is fine. That is a query-shape mismatch, not data loss. Do not go
looking for a destructive write.

### Error capture

`automation_errors` holds one row per error event, foreign-keyed to
`automations`, idempotent on `platform` + `external_error_id`. Capture is a
cron-driven sweep plus a manual "Check for New Errors" button, built for Make
and n8n only.

Read helpers live in `src/lib/automations/errors.ts` and feed four surfaces: the
Error History page, the Last Error column, the error count stat and the
days-since-last-error stat.

> 🔻 **Recurring bug, do not reintroduce.** Error History rows must live-update
> from **the page's own steady poll**, never coupled to the Auto-refresh toggle.
> Coupling them is what keeps bringing back "I have to reload to see new
> errors". Fixed once in PR #175; do not undo it.

### `app_settings` is the no-migration store

A key/value table. Used for the auto-refresh state, the Feature Integration
checklist, and the Design Versions status overrides. If you need to persist a
small amount of shared, app-wide state and a whole table would be overkill,
**use a new key here instead of writing a migration.** Pattern to copy:
`src/lib/automations/feature-integration.ts` and its API route.

### The design-version registry

`src/lib/automations/versions.ts` lists every parallel design of a page in this
tab. Each is a self-contained page at its own top-level route, which is what
stops experiments from breaking live pages.

> 🛑 **Do not factor shared pieces out of bench pages.** Leaf components in
> `src/components/automations/` are fine to share (`version-tile.tsx`,
> `site-icon.tsx`, `version-directory-list.tsx`). A bench page's _layout_ is
> not. The point of a bench is that it cannot break anything.

A version's state is derived from flags (`official`, `shipped`, `parked`,
`archived`) and can be overridden per version from the UI. The words are not
interchangeable:

- **parked**: finished and waiting on a _business_ decision. The next move is
  theirs.
- **archived**: the question it was asking is settled. Nothing is waiting.
- These two are **opposites**. The AlphaA light/dark trio is parked, and must
  not be archived while that is true.
- **deleted**: gone. Archived pages still work and still open. If a page is
  genuinely dead, delete it rather than flagging it.

> 🛑 **Never archive a version on your own judgement.** The user says what is
> finished. Ask every time; do not carry a previous answer forward. The same
> question got opposite answers five days apart (a shipped winner was archived
> with its losers once, and deliberately kept out the next time).

### The Housekeeping page, and the two lists it loads from one query

`/automations/housekeeping-alerts` is the documentation worklist: **every
automation missing at least one of the four required fields** (Automation Tags,
Trigger Event, Evaluation, Purpose). 499 rows of 964 as of 2026-10-08. Clicking
a row opens the same `WorkflowDialog` the website tables use; clicking the
automation's own link opens it in a new tab **and** the dialog.

> 🛑 **The rule is written twice and the two copies must agree.**
> `missingRequired()` in `housekeeping-rule.ts` is the JS half (no database
> import, so the client shares it) and decides which chips a row shows.
> `flaggedRows()` in `housekeeping.ts` is the SQL half and decides whether a row
> is returned at all. Nothing derives one from the other, so a field joining or
> leaving the required set is an edit to both.

The page renders three cards, and **two of them are lists of automations**:

| card                             | what it holds                                        |
| -------------------------------- | ---------------------------------------------------- |
| Documentation of Required Fields | coverage of the four fields across all five websites |
| Recently Edited in Motherboard   | the five automations a person last edited in the app |
| Housekeeping List                | the worklist itself, with a live entry count         |

**Why the second list exists.** Filling an entry in is exactly what removes it
from the worklist, so the entry you most need to revisit is the one you can no
longer see. Measured before it was built, on 2026-10-08: 78 of 964 automations
had ever been edited in the app, and the nine edited that day were all complete,
meaning all nine had just vanished off the list. (That counter moves as the work
happens: it read 79 a few hours later.)

> ⚠️ **"Recently edited" means `row_updated_at`, which is app-wide, not
> page-scoped.** An entry edited from a Per Website page appears there too. That
> was the user's choice over a new column recording the source page. See the
> three date columns in section 4 for why `updated_at` would have been wrong.

**All three cards carry a header bar**, same classes, because two of them are
lists of automations that look alike: website glyph, name, blue link. Before the
second list arrived the worklist needed no label; afterwards the only thing
telling them apart was that one had chips. **Adding a second instance of a thing
can make the first one ambiguous, and the first one was never built to say what
it is.**

#### The second list rides along on the first list's query

`getHousekeepingLists()` returns `{ rows, recentlyEdited }` from **one base
query**. The five recently-edited ids arrive as a **subquery inside that query's
`where`**, so the four selection reads below it cover both lists for free.

> 🛑 **Do not split this into a second loader.** The obvious build is its own
> base query plus its own four selection reads, which puts **eight reads in
> flight at once** against a `max: 10` pool. That fan-out is what took the hub
> down once; see section 8.

Two details that keep it honest:

- **The slice is correct by construction.** `rows` holds the flagged rows plus
  the global five, so sorting by `row_updated_at` and taking five cannot return
  anything else: any flagged row recent enough to outrank fifth place would
  already be one of the five. The `limit` in the subquery is what makes that
  true.
- **`isFlagged` is selected from SQL**, so a row's membership of the worklist is
  the predicate's own verdict. Splitting the two lists in JS on
  `missing.length > 0` would work until the two halves of the rule drifted, and
  would then **silently drop a row from the worklist** rather than merely
  mis-drawing its chips.

#### Layout: three cards, one grid

Flex column when stacked, CSS grid at `2xl` and above. The table spans both grid
rows on the left; the two panels stack on the right.

| width       | order                                          |
| ----------- | ---------------------------------------------- |
| below 1536  | **table**, coverage, recently edited           |
| 1536 and up | table on the left, the two panels on the right |

> 🛑 **The stacked order is the user's, and it took four goes to settle. Do not
> re-derive it.** Both panels above the table (#611), the recently edited panel
> below it (#612), above it again (#613), then **both panels below the table**
> (#617). The work comes first; everything about the work comes after it.

Both sides of that argument are worth keeping, because it was decided twice in
each direction. **For panels first:** the coverage panel summarises the list
beneath it, and the recently edited panel is how you get back to an entry that
finishing has just removed, so a tool you cannot see is a tool you forget you
have. **For the table first:** measured at 1400x950, two panels above put the
list window on its clamped 240px floor; table first gives it **633px**.

---

## 3. What each website can actually do

This is the hard-won part. It is documented in the app at
`/automations/feature-integration`, and the research behind it is below so
nobody re-runs it.

|         | Refresh List     | Error tracking                        |
| ------- | ---------------- | ------------------------------------- |
| Make    | yes              | yes, the strongest source of the five |
| n8n     | yes              | yes                                   |
| GHL     | yes              | **confirmed impossible**              |
| GHL B2B | yes              | **confirmed impossible**              |
| Zapier  | **out of scope** | **out of scope**                      |

**Make.** REST API lists scenarios and exposes per-scenario logs filterable to
failures, plus a dead letter queue. Region `us1`, org `1193307`, paid plan.

**n8n.** Public API lists workflows, and `GET /executions?status=error` sources
error tracking, with the message and failing node available per execution.
Caveats: the list endpoint omits per-row status (use the filter), combining
`includeData=true` with `workflowId` can 400 on large payloads, and n8n Cloud
prunes history.

**GHL and GHL B2B, error tracking: a confirmed dead end, do not re-research.**
The Workflows API is list and detail only. There is no executions endpoint, no
"workflow errored" trigger or webhook, and the rich execution logs exist only in
the UI. The one external signal is a throttled, unstructured admin email.

**Zapier: out of scope rather than impossible.** A list-Zaps API exists
(`/v2/zaps`) but is gated behind publishing a public integration plus OAuth2,
which this project is not taking on. There is no Zap-free error API, though a
monitor Zap's "New Zap Error" webhook was confirmed by live test to deliver the
failing Zap's numeric id, link and message. **Zapier rows therefore come from a
re-runnable CSV import**, which is why section 5 exists.

**One API credential per platform is enough.** Make, n8n, GHL and GHL B2B need
one key each; Zapier needs none. Assume this when designing; revisit only if a
specific feature proves otherwise.

---

## 4. Table and data conventions

### Defaults

- **New fields are OPTIONAL.** Only `Link` is mandatory. Make a new column
  required only if the user explicitly says so.
- **New columns are CENTRE-ALIGNED.** `text-center` on both the `<th>` and the
  `<td>`; add `justify-center` if the header has an inline-flex label and sort
  arrow. The only left-aligned column is the frozen **Name** column, which
  carries the link beneath it.
- **Transient inline error text fades after 5 seconds.** That is the default; do
  not make anyone re-specify it.

### Three date columns, and picking the wrong one is silent

An automation carries three timestamps that all sound like "when it changed".
They are not interchangeable, and nothing fails loudly when you reach for the
wrong one.

| Column           | Shown as     | Written by                                              |
| ---------------- | ------------ | ------------------------------------------------------- |
| `last_run_at`    | Last Runtime | the sync only. When it last RAN on its platform.        |
| `last_edited_at` | Last Edited  | the sync only. When it was last edited ON ITS PLATFORM. |
| `row_updated_at` | Row Update   | the app only. When a PERSON last edited this row here.  |

> 🛑 **`row_updated_at` is the only one that means "a human did something", and
> `updated_at` is NOT a substitute.** Every sync writes `updated_at`, so a
> background refresh moves it for hundreds of rows at once. Only
> `POST /api/automations` and `PATCH /api/automations/[id]` may touch
> `row_updated_at`; no `*-sync.ts` file may mention it.

It is NULL on every row nobody has opened in the app, which is most of them
(886 of 964 as of 2026-10-08), and it is deliberately not backfilled. So any
feature reading it needs a real empty state rather than a theoretical one.

**Who depends on this today:** the Row Update column on the Per Website tables
and `/automations/all`, and the "Recently Edited in Motherboard" panel on the
Housekeeping page, which exists because filling an entry in is exactly what
removes it from that page's list. Swap in `updated_at` there and the panel
quietly becomes a list of whatever the last sync touched.

### Adding or removing a table column: the touch-list

The column data flows through several files and it is easy to miss one. Verify
each against the code as you go; this list is a map, not a contract.

1. **Database**: `src/lib/db/schema.ts`, plus a hand-written idempotent
   migration in `supabase/migrations/` using `ADD COLUMN IF NOT EXISTS`.
2. **Server query**: the select in `[platform]/page.tsx`.
3. **Sync getters and upserts**: the per-platform row getters, and the upsert in
   each `*-sync.ts` if the sync populates the column.
4. **Row type**: the `AutomationRow` interface in `automations-table-client.tsx`.
5. **Table render**: the `<th>` and the `<td>`, centre-aligned.
6. **Empty-state colSpan**: the "No automations" row uses
   `colSpan={editMode ? N : N - 1}`. Bump N.
7. **The workflow dialog**: a form field if the column is editable; otherwise
   add it to the carry-through row mapping so an edit does not blank it.
8. **Sorting**: extend the sort key type and the sort switch, and make the
   header clickable. Date columns keep blanks last in both directions.
9. **Sticky layout**: mind the table's `min-w-[...]` and the z-index layering:
   corner `z-20` above header and frozen column `z-10` above body.
10. **Synced-column marker**: if the sync writes this column, add it to the
    per-platform `SYNCED_COLUMNS` map so the header shows the ↻ marker. It is
    per platform (GHL has no Last Runtime). A never-synced column such as
    Purpose is simply left out.
11. **View All Lists**: ask whether it belongs there too.

### CSV export

The "Export CSV" button is client-side: build a Blob, click a temporary
`<a download>`, revoke the URL. Filename `<platform>-automations-MM-DD-YYYY.csv`.

- Exports **all** rows, not the filtered or sorted view.
- Name and Link are the first two columns, then **the middle columns in the
  table's current on-screen order**, including any reordering the user has done
  by dragging.
- Dates are `MM-DD-YYYY` via the shared `formatDateCell`. Status uses the app's
  own `active` / `paused`, not the source platform's words. Link is the
  canonical stored `external_url`.
- RFC-4180 escaping is mandatory: wrap any field containing a comma, quote or
  newline in quotes and double the internal quotes. Purpose can contain all
  three. A UTF-8 BOM is prepended so Excel reads it correctly.
- Line breaks inside a field are kept **faithfully**. A flattening tweak was
  built once and deliberately discarded.

> 📌 **A note for anyone reading older documentation.** The export used to own a
> standalone `EXPORT_COLUMNS` array, with a standing rule that you had to
> reorder it by hand whenever the table columns moved. **That is no longer
> true.** The export now derives its columns from the table's live ordered
> column list, so the order cannot drift. There is nothing to keep in sync.

---

## 5. The "Automations CSV Importing" procedure

This has an official name because it is pulled up whenever a CSV goes into a Per
Website Page. Zapier is the real target, since the other four sync themselves,
but the identity logic is written per platform in case it is reused.

### Match on identity, never on the URL string

**The same automation can be reached by structurally different links.** A naive
exact-string match creates a duplicate instead of updating the row. For example
in GHL, `.../location/<loc>/workflow/<id>` and
`.../v2/location/<loc>/automation/workflows/builder/<id>` are the same workflow.

Per-platform identity:

| platform        | link shape                                                          | identity                       |
| --------------- | ------------------------------------------------------------------- | ------------------------------ |
| Make            | `https://<zone>.make.com/<teamId>/scenarios/<id>/edit`              | the numeric scenario `<id>`    |
| n8n             | `<base>/workflow/<id>`                                              | the workflow `<id>`            |
| GHL and GHL B2B | canonical `.../v2/location/<loc>/automation/workflows/builder/<id>` | `<loc>` plus the workflow UUID |
| Zapier          | `https://zapier.com/editor/<zapId>/<published or draft>`            | **the numeric `<zapId>` only** |

For every row: extract the identity, look up by identity (match updates, no
match inserts), and **store the link in the same canonical form the live sync
writes**. If you store the CSV's variant form, the next sync writes the
canonical form, fails to recognise the variant, and duplicates the row.

**Zapier specifics.** The trailing `/published` or `/draft` is a state variant,
not part of the identity; always normalise to `/published`. Two CSV rows with
the same id are the same Zap: collapse to one, last write wins, do not prompt.
Status mapping is default-to-paused: only the literal `running` (trimmed, case
insensitive) becomes `active`, everything else becomes `paused`.

### Merge rules on a re-import

The import is **a re-runnable upsert, last write wins per filled column, blanks
ignored**. Not a one-time load.

1. **A blank or missing CSV column leaves the stored value alone.** It must not
   wipe it to empty. Same rule as the sync.
2. **A filled CSV value overwrites.** Accepted consequence: a re-import
   overwrites manual in-app edits to mapped columns. For Zapier the CSV is the
   source of truth, so that is intended.
3. Adding a column later costs a small parser change to map the new CSV header.
   Unmapped CSV columns are ignored until then.

### Phases 0 to 7

0. **Connect.** Read access to the live database. See section 8 for how.
1. **Read the CSV.** 🛑 **Ask the user to provide or point at the file. Do not
   go hunting in the import folder and pick one yourself**, even if you are
   confident. This is the checkpoint that catches a stale file before any data
   is touched, and it exists because an auto-picked file turned out to be a
   months-old export covering 27 of 144 live rows.
2. **Normalise and clean**, in memory, no database writes. Extract identities,
   rewrite links to canonical form, dedupe within the CSV, validate, flag bad
   rows.
3. **Read existing rows** and diff against the cleaned CSV, matching by identity.
4. **Preview and approval.** Show counts ("X new, Y updates, Z skipped"),
   samples and per-update diffs. The merge policy is pre-decided, so you are
   surfacing what _will_ change, not asking how to merge. **Nothing is written
   until the user says go.**
5. **Execute.** Idempotent `INSERT ... ON CONFLICT (external_url) DO UPDATE`.
   There is a unique index on `external_url`. No deletes, ever. The user picks
   whether you run it or hand them SQL for the Supabase editor.
6. **Verify** by re-querying, not by trusting the writer.
7. **Clean up** any pulled credentials.

**Guarantees this buys:** no duplicates (identity match plus canonical storage),
no data loss (upsert only, never deletes), no surprise writes (preview and
approval first).

---

## 6. UI conventions that will bite you

These are all real bugs that shipped at least once.

**Dropdowns have a documented standard.** `docs/dropdown-menu-standard.md`.
Reuse the existing automations comboboxes and the `use-popover-side` hook rather
than rebuilding. Read it before changing dropdown sizing or placement.

**Dialogs with growable content must cap and scroll.** Any Add or Edit dialog
containing a textarea needs `max-h-[85vh] flex-col` on the content, a
`flex-1 overflow-y-auto` field area and a pinned `shrink-0` footer. Otherwise
long content pushes the buttons off screen. Reference: `workflow-dialog.tsx`.

**Tooltips close when the cursor leaves the trigger.** Add Base UI's
`disableHoverablePopup` to every `<Tooltip>`. Note it is Base UI, not Radix, so
it is not Radix's `hoverable` prop.

**Never put a display utility on a `line-clamp-*` element.** Tailwind v4 emits
`.block` after `.line-clamp-*`, which silently kills the clamp. Line clamp must
be the only thing setting `display`.

**A long unbroken token stretches its column.** Use
`[overflow-wrap:anywhere]`, plus `max-w-full` on inline-block pills. Do **not**
use `break-words`, which does not reduce min-content.

> 🛑 **With one exception, found the hard way.** In a _flexible table cell_ that
> rule inverts: `overflow-wrap: anywhere` removes the longest word as the
> column's minimum, so the column can collapse without limit. Measured once at
> 11px wide and 45 lines tall in a 732px row. Use it for fixed-width boxes; not
> for a cell whose width is whatever is left over.

**A `<span>` used as a masked icon needs `block`.** Width and height do nothing
on an inline element, so a CSS-masked glyph silently measures 0 by 0. It only
breaks where the span is not a flex child, so the symptom looks like "some rows
have no logo".

**`flex` on an `<a>` makes its whole row clickable.** A flex container is
block-level, so the anchor fills its parent whatever its text measures, and
every pixel of that box is a hit target. The symptom is a link that "works"
when you click empty space to the right of it. Reported on the Housekeeping
panel on 2026-10-10 and measured at **318px of invisible hit area** past the
end of the URL.

> 🛑 **The fix is `w-fit max-w-full`, and `w-fit` alone is not enough.**
> `fit-content` resolves to `min(max-content, max(min-content, available))`, and
> a URL is **one unbreakable token**, so its min-content is the whole string and
> that `max()` hands back more than the container has: measured at 359px inside
> a 346px box, overflowing and no longer truncating. ⚠️ `min-w-0` on the inner
> span does not prevent it. That lets the flex algorithm _shrink_ the span once
> the width is definite; it does not reduce the span's min-content _size_, which
> is what intrinsic sizing asks for.
>
> 📌 Prefer `w-fit` over `inline-flex`, which also fixes the width but puts the
> box on a text baseline and adds descender space beneath it.

⚠️ **This markup is copied across five places** (`housekeeping-alerts-client`
twice, `automations-table-client`, `all-automations-table-client`,
`error-history-table`). Only the two in Housekeeping are fixed. Measured
2026-10-10 at 1920: View All Lists has a dead zone on **349 of its 964 links**
(worst 139px), Error History on **all 37** (worst 74px), the Per Website tables
on most rows (worst 74px). The user chose to fix Housekeeping only for now, so
**the other three are known, measured and deliberately outstanding.**

**Table headers are bold by default.** The `<th>` UA style, which Tailwind v4
does not reset. A header rendered as a `<div>` needs `font-bold` to match; a
`<th>` that should _not_ be bold needs an explicit `font-medium`.

**A native `<datalist>` filters its options against the text already in the
input.** A field showing `active` will list only `active`. Widening the option
list is an invisible non-fix; the field has to become a `<select>`. This cost a
PR once.

**On a page with a width floor, use container queries, not viewport ones.**
`sm:` and `lg:` ask the window, which has no idea the page is holding its own
width and scrolling. Use `@container` with `@min-[Npx]:`. Any page you add a
floor to needs its responsive utilities audited for this.

**A `Card` whose first child is a header bar needs `pt-0 gap-0`.** `Card` is a
flex column with `py-4` and `gap-4`, which is right when its only child is
content and wrong the moment you put a tinted header strip at the top: it floats
16px below the card's edge with another 16px of air under it. Keep `pb-4`, which
is the chrome `useFitViewportHeight`'s `bottomGap` is tuned around, and put the
header **outside `CardContent`** so it does not scroll away.

**A scroll container sized by `useFitViewportHeight` can be clamped, and a
clamped container stops responding to its own cause.** The hook sizes an element
from its top to the bottom of the window, with a `minHeight` floor of 240px.
Anything you stack above it is paid for twice, in position and in height, and
once the computed fit drops under the floor the element is pinned there. It
happened once on Housekeeping: the element rendered at exactly 240px while the
space available to it came to 125px, so it was not "a bit tight", it had
bottomed out and further changes above it would have done nothing at all.
**Check for the clamp before theorising about the layout.**

> 📌 **There is no option for this, and that is deliberate.** A `discountRef`
> was added for exactly this case (#614) and removed hours later (#618), once
> the panels it existed for moved below their table and it stopped firing. It
> is in the git history of `use-fit-viewport-height.ts` if the situation comes
> back. What it did, if it ever needs rebuilding: subtract one named sibling's
> **height plus one row gap** from the measured offset when that sibling sits
> above the container. Not the distance between the two elements, which looks
> right and is wrong, because that space also holds chrome which does not
> disappear along with the element.
>
> 🛑 **The lesson is the removal, not the mechanism.** All eleven call sites
> pass no arguments again. A wired mechanism that quietly does nothing is worse
> than no mechanism, because the next reader has to prove it is inert before
> they are allowed to ignore it.

**Width floors are measured, not guessed, and they are a judgement.** Strip the
floor, set `width: min-content`, read the box. Two traps: min-content lies when
a child carries `min-w-0` (it reports the squash limit, not the need), and for a
list that truncates it reports "nothing is abbreviated", not "something breaks".
Pick the floor by deciding how much abbreviation is acceptable, then verify
nothing clips at it, and write the reasoning next to the number.

---

## 7. Working practice

**This is not the Next.js you know.** Read the relevant guide in
`node_modules/next/dist/docs/` before writing code. APIs, conventions and file
structure may differ from what you remember.

**Branch, PR, then ask.** Feature branch, pull request, quality gates, and then
**ask the user whether to merge to production. Never merge without an explicit
yes**, and ask again next time rather than assuming a standing approval.

> 🛑 **Do not chain `gh pr checks` and `gh pr merge` on one line.** `--watch`
> exits when the checks finish, not when they pass, and `;` does not care. Read
> the result, then merge in a separate command. This merged a PR with a failed
> preview deploy once.

**Gates:** `tsc --noEmit`, `eslint`, and a build when the change could affect
one. All three must pass before a PR.

**Prettier uses CRLF in this repo.** Run it with `--end-of-line crlf`.

> 🛑 **`src/` is not drift-free.** Hundreds of files fail `prettier --check` on a
> clean `main`. **A check failure on a file you touched is not evidence the
> drift is yours.** Compare the complaint count against `main` before acting,
> and **never run `--write` on a file with pre-existing drift**: a 16-line
> feature once came out as a 932-line diff. Rewriting a block by hand is the
> safe way to clear drift inside it.

**Migrations get a prominent heading and step-by-step instructions**, because
the user runs them in Supabase by hand. Make them idempotent.

**No em-dashes**, anywhere: chat, UI copy, code, comments, commit messages, PR
bodies. Use a comma, colon, parentheses, two sentences, or "to" for a range.

**Record every tweak and decision** in the project's running lists as you ship,
without being asked. That is what keeps this guide and its sources from going
stale.

**Three lists track the work**, and intake is user-driven in every direction:
a to-do list, a Done List, and an Impossible List (truly impossible, or out of
scope). Ask before moving anything between them, and never check an item off
silently.

---

## 8. Operations and environment

**The database connection pool is `max: 10`, and the limit is a race, not a
ceiling.** A single `Promise.all` of eleven reads took a page down in
production. Measured: 8 fine, 9 fine, 10 throws. **Cap fan-out at about six and
split into waves. Never raise `max`.** The fingerprint is SQLSTATE 57014,
"canceling statement due to statement timeout", with one page's queries stuck
`active`.

**`DATABASE_URL` in `motherboard/.env.local` is the Supabase transaction pooler**
(port 6543, `prepare: false`). Live read and write access works from throwaway
scripts, which is how CSV imports and data audits are run. **It is the master
key to the whole production database.** Treat it as a secret, never commit or
paste it, and remember that anything you write from a local script writes to
production.

**Secrets stay server-side.** Only booleans about credentials ever reach the
client. There is a check-key route for presence; the key itself never crosses.

**Production builds fail randomly on a `next/font/google` module-not-found.**
It is a build-time fetch of Google Fonts being unreachable, not our code, and an
identical build often passes on retry. Keep the build cache on so cached fonts
get reused. The permanent fix is self-hosting via `next/font/local`, which has
been offered and deferred. Before blaming it, check three cheap signals: a local
`rm -rf .next && npm run build`, the production deploy status, and whether the
live URL responds.

**If a merge to main stops deploying at all**, check the Vercel project's
Settings then Git for a "Project Link not found" broken repository link and
reconnect it. The GitHub App has lost repository access before.

**`pg_pgrst_no_exposed_schemas does not exist` (3F000) in the Postgres logs is
benign.** It is PostgREST probe noise, not this app, which uses Drizzle
directly. Do not re-investigate.

**Deleting a route leaves a stale type validator.** `npm run build` or
`tsc --noEmit` will fail with `TS2307` naming the page you just removed. Run
`rm -rf .next`. It looks like a real breakage in your own diff and is not.

**Measuring the UI behind `requireAuth`.** A dev server started with
`NEXTAUTH_SECRET` empty renders every authenticated page as a mock super admin:

```
NEXTAUTH_SECRET= NODE_ENV=development npx next dev -p 3007
```

Two things to know. It produces client-side session fetch errors in the console
that are the bypass, not a bug. And **every write endpoint 500s under it**,
because the mock user id is not a row in `admin_users` and `updated_by` is a
foreign key. Before debugging a new endpoint that fails this way, post to the
oldest equivalent one; if that fails identically, it is the environment.

---

## 9. The brief is a guide, not law

`AUTOMATIONS_FEATURE_BRIEF.md` is the starting point, not a contract. The user
decides direction. Consult the brief when the direction is unclear, and **warn
before building something that deviates from it** rather than either refusing or
silently diverging.

**One deviation is already live and deliberate.** The brief describes one
`/automations` list page grouped by platform, plus per-automation detail pages.
What exists is **one page per platform**, five of them, each with its own table.
This was flagged and the user chose it. The brief's data model still supports it.

**"Link as identity"** is the user's framing and maps to `automations.external_url`
plus `external_id`. The URL is the canonical anchor for a row, which is why
section 5 is so careful about canonical forms.

**Implementation reference: the Subscriptions tab**, not Campaigns. It is the
closest existing pattern for the Edit-mode toggle, the add button that appears
in edit mode, the add dialog and click-row-to-edit.

---

## 10. Where to look next

| you want                             | open                                          |
| ------------------------------------ | --------------------------------------------- |
| what the tab is for                  | `AUTOMATIONS_FEATURE_BRIEF.md`                |
| dropdown sizing and placement        | `docs/dropdown-menu-standard.md`              |
| what each website's API can do       | `/automations/feature-integration` in the app |
| the parallel design experiments      | `/automations/design-versions` in the app     |
| how an external provider is wired    | `src/lib/providers/INTEGRATION_GUIDE.md`      |
| why row loading has exactly one path | `docs/per-website-row-loading.md`             |
| what is under-documented right now   | `/automations/housekeeping-alerts` in the app |
| the Next.js version's own docs       | `node_modules/next/dist/docs/`                |
