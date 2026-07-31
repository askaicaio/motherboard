<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Building a dropdown?

Searchable single/multi-select dropdown pickers have a documented standard:
`docs/dropdown-menu-standard.md`. Reuse the existing components (the automations
choice comboboxes + the `use-popover-side` hook) rather than rebuilding, and read
that doc before changing dropdown sizing/placement.
