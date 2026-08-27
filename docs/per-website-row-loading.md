# Per Website row loading (Automations tab)

**Rule: every code path that hands rows to the Per Website table goes through
`getPerWebsiteRows()` in `src/lib/automations/per-website-rows.ts`. One query, no
exceptions.**

This document exists because breaking that rule caused a production incident that
looked exactly like destructive data loss but was not. If you are an AI agent or a
dev picking this up cold, read the incident section first, it is the fastest way to
recognise the symptom.

---

## The incident (2026-08-18)

**Symptom.** On a Per Website page (Make), clicking **Refresh List** blanked most of
the table. Author, Automation Tags, Trigger Event, Notes, GHL Tags, GHL Forms,
Webhook Links, and Last Error all rendered as empty. Name, Status, **Purpose**, Last
Edited, and Last Runtime survived. It read as if the refresh had wiped the database.

**It was not data loss.** A direct DB check confirmed every value intact:

```
automations (make):  total 115 | purpose 113 | notes 113 | trigger_event 113
dropdown selections: 138 selections across 113 rows
webhook links:       37 links across 36 rows
```

A page reload restored the display. The sync writers (`syncMakeAutomations` and
friends) only ever patch `name`, `status`, `platform`, `lastRunAt`, `lastEditedAt`,
and they explicitly refuse to overwrite a stored timestamp with null. They never
touch purpose, notes, the choice ids, or the junction tables.

**Root cause.** Three different code paths loaded rows with three different queries:

| Path | Query | Columns |
| --- | --- | --- |
| Page server component | rich query with joins + selections | full shape |
| `POST /api/automations/sync` | `getMakeRows()` / `getN8nRows()` / `getGhlRows()` | **7 only** |
| `GET /api/automations?platform=` | `select()` on the base table | base columns, no joins or selections |

The client replaces its rows with the response wholesale:

```ts
if (Array.isArray(data.rows)) setRows(data.rows);
```

So a refresh swapped rich rows for 7-field rows and every omitted column rendered
empty. **Purpose survived only because it happened to be one of those 7 fields.**
That coincidence is what made the bug look arbitrary and alarming.

**Fix.** The rich query moved into `getPerWebsiteRows(platform)`. The page, the sync
route, and the poll route all call it. The three short getters were deleted.

---

## Why TypeScript did not catch it

`AutomationRow` in `src/components/automations/automations-table-client.tsx`
declares almost every field optional:

```ts
export interface AutomationRow {
  id: string; name: string; externalUrl: string; status: string;
  purpose?: string | null;
  notes?: string | null;
  author?: string | null;
  automationTags?: SelectedChoice[];
  ...
}
```

A 7-field object satisfies that interface perfectly. The compiler had no way to
object. **Do not rely on `tsc` to catch a short row payload.** It cannot, by
construction, until those optionals become required-and-nullable (a deliberate
future option, deferred 2026-08-18 as unnecessary once there is only one loader).

---

## Adding a new column to the Per Website table

Adding a column is **safe** and does not reintroduce the bug, as long as it goes in
the shared loader. Note the failure mode if you forget: the **page itself** renders
the column blank, not just the post-refresh state, so you catch it in dev
immediately rather than in prod after a refresh click.

Order of work:

1. **`src/lib/automations/per-website-rows.ts`** — add the column to the select (or
   the merge step, if it comes from a junction or a separate helper). This is the
   only query; every consumer picks it up automatically.
2. **`AutomationRow`** in `automations-table-client.tsx` — add the field.
3. **`MiddleColumnId` + `MIDDLE_COLUMNS`** in the same file — the one descriptor
   list that drives the header, the body cell, and the CSV export.
4. **`MIDDLE_DEFAULT_ORDER`** — insert at the intended default position.
5. **`COLUMN_WIDTHS`** — give it a width, or the table min-width maths under
   column hide/show goes wrong.
6. **`AllColumnId` + `ALL_COLUMNS`** in `all-automations-table-client.tsx`, only
   if the column also appears on View All Lists. That table has its **own query**
   (in `app/(dashboard)/automations/all/page.tsx`), so **add the field to that
   select as well**, or the column renders blank there while working on the Per
   Website pages.
   > **This step used to say something else and was wrong.** It described hiding
   > by 1-based `nth-child` position in a scoped `<style>` block, which meant
   > inserting a column shifted every later index. That was replaced by the
   > data-driven `ALL_COLUMNS` list in PR #362, so positions no longer exist and
   > nothing needs renumbering. Corrected 2026-08-23.
7. **Sorting**, if the column is sortable: add it to the `SortKey` union **in both
   table files** and give it a branch in the comparator. The four date columns
   (Last Edited, Last Runtime, Last Error, Row Update) share one branch and are
   deliberately **inverted** (`-dir`), so the first click shows newest first.
8. **Add/Edit dialog** (`workflow-dialog.tsx`) and the write routes, if the column
   is user-editable rather than synced.
9. **`SYNCED_COLUMNS`**, if a sync writes it: that map drives the ↻ marker. Leave
   the column out entirely if no sync touches it.

The CSV export needs no separate step: it is driven by the same `MIDDLE_COLUMNS`
descriptors via each column's `exportValue`, so it picks up a new column and its
position automatically.

### Worked example: "Row Update" (2026-08-23)

A column no sync may ever write, recording when a **person** last created or
edited the row in the app. Useful as a template because it exercises most of the
list: migration `0050`, schema field, both loaders, both column models, the shared
date comparator, both cell renderers, and the two app write routes, while
deliberately appearing in **none** of the `*-sync.ts` files. That last part is the
whole feature, and it is verifiable with a single grep:

    grep -rn "rowUpdatedAt" src/lib/integrations/

If that ever returns a hit, the column has silently become another
`last_edited_at`.

## The trap that remains

Not adding columns. Writing a **new** row-returning endpoint that selects rows
itself. Because of the optional-field problem above, a short payload from a new path
still type-checks and still silently blanks columns. If you need rows somewhere new,
call `getPerWebsiteRows()`. If you genuinely cannot, you own keeping the shape
identical, and you should say so in a comment at the call site.

## Diagnostic signature

If someone reports "the refresh erased my table":

1. Do not panic and do not restore from backup. Check the DB first, the values are
   very likely intact.
2. Ask which columns survived. A **subset** surviving points at a payload-shape
   problem, not at a writer. A genuine wipe would not spare arbitrary columns.
3. Confirm a reload restores the display. If it does, the bug is client-side row
   replacement, and the culprit is whichever query fed that response.
