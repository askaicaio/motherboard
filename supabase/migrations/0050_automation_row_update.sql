-- =============================================================
-- "Row Update": when a PERSON last changed this row in the Motherboard
-- =============================================================
-- Records the last time a human edited (or created) an automation THROUGH THE
-- APP. This is deliberately SEPARATE from two existing columns that both look
-- like they might already do this, and neither does:
--
--   automations.last_edited_at  the SOURCE PLATFORM's own edit date, written by
--                               the sync from GHL/n8n `updatedAt` and Make
--                               `lastEdit`. Tells you when the automation
--                               changed in GHL, not when anyone touched OUR row.
--
--   automations.updated_at      touched by the SYNCS as well as the app (see
--                               ghl-automations-sync.ts, make-sync.ts,
--                               n8n-sync.ts), so a background refresh moves it.
--                               Useless as a "a person did something" signal.
--
-- ⚠️ THE WHOLE POINT IS THAT THE SYNCS MUST NEVER WRITE THIS COLUMN. Only the
-- two app write paths set it:
--     src/app/api/automations/route.ts        (POST, create via the dialog)
--     src/app/api/automations/[id]/route.ts   (PATCH, edit via the dialog)
-- The three *-sync.ts files must not mention row_updated_at at all. If a future
-- sync sets it, the column silently becomes another last_edited_at and the
-- feature is gone.
--
-- NULLABLE AND NOT BACKFILLED, on purpose. There is no honest way to know when
-- existing rows were last edited by a person, so they stay NULL and render "-"
-- until someone next edits them. Inventing a date would be worse than a blank.
-- (That includes rows changed by one-off maintenance scripts, e.g. the Zapier
-- duplicate curation: those were script writes, not app edits.)
--
-- Idempotent, safe to run more than once.
-- =============================================================

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS row_updated_at timestamptz;

-- Sorting is client-side over the loaded rows, so no index is needed today.
-- Add one only if this column ever drives a server-side ORDER BY or filter.
