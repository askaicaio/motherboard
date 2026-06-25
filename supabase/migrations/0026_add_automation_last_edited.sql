-- =============================================================
-- Automations — add "last_edited_at" column
-- =============================================================
-- Timestamp of when an automation was last EDITED/modified on its source
-- platform (distinct from last_run_at, which is when it last RAN).
-- OPTIONAL (nullable). Filled by the sync (n8n `updatedAt`, Make `lastEdit`)
-- or the one-time Zapier CSV import, never via the Add/Edit dialog. GHL exposes
-- no edit timestamp, so it stays NULL there (same as last_run_at). Surfaced via
-- the "Last Edited" column on the Per Website Page table, formatted MM-DD-YYYY
-- ("-" when empty). Idempotent; safe to re-run.
-- =============================================================

ALTER TABLE "automations"
  ADD COLUMN IF NOT EXISTS "last_edited_at" timestamptz;
