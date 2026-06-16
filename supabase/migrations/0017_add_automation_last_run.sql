-- =============================================================
-- Automations — add "last_run_at" column
-- =============================================================
-- Timestamp of when an automation last ran on its source platform.
-- OPTIONAL (nullable). Filled only by the sync (Refresh List / auto-refresh),
-- never manually. Surfaced via the "Last Runtime" column on the Per Website
-- Page table, formatted MM-DD-YYYY ("-" when empty). Idempotent; safe to re-run.
-- =============================================================

ALTER TABLE "automations"
  ADD COLUMN IF NOT EXISTS "last_run_at" timestamptz;
