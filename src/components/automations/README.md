# Automations components

**Read `AUTOMATIONS_DEV_GUIDE.md` in the repo root before changing anything in
here.** It covers the conventions that are not visible from the code: why the
five Per Website Pages are one component, what each external API can and cannot
do, the CSV import procedure, and the UI rules that have each caused a real bug
(line-clamp, masked icons, `overflow-wrap`, datalists, width floors).

Three things worth knowing before you open a file:

- **`automations-table-client.tsx` is all five Per Website Pages at once.** One
  dynamic route, one client component. A change here changes Make, n8n, GHL,
  GHL B2B and Zapier together.
- **`all-automations-table-client.tsx` is a deliberate fork** of that table for
  View All Lists. It is allowed to diverge. When you add a column or feature to
  the Per Website Page, ask whether it belongs here too.
- **The leaf components are shared on purpose** (`version-tile.tsx`,
  `site-icon.tsx`, `color-badge.tsx`, the comboboxes). Bench pages under
  `src/app/(dashboard)/automations-*` may import these, but must never share
  each other's page layout.
