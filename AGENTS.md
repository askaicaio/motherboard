<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Building a dropdown?

Searchable single/multi-select dropdown pickers have a documented standard:
`docs/dropdown-menu-standard.md`. Reuse the existing components (the automations
choice comboboxes + the `use-popover-side` hook) rather than rebuilding, and read
that doc before changing dropdown sizing/placement.

# Working on the Automations tab?

Read `AUTOMATIONS_DEV_GUIDE.md` in the repo root first. It holds the
conventions that are not visible from the code: the five Per Website Pages are
ONE component, what each external API can and cannot do (two of them are
confirmed dead ends, do not re-research), the CSV import procedure, the UI
rules that have each caused a real bug, and the operational traps (the DB pool
is max 10, prettier drift, the random Vercel font failure).
