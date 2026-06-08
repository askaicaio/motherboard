-- =============================================================
-- Automations — add "status" column
-- =============================================================
-- Per-automation state shown on the Per Website Page table and counted on
-- the Main Page cards. Two values: 'active' | 'paused'. New rows default to
-- 'paused'. Idempotent; safe to re-run.
-- =============================================================

ALTER TABLE "automations"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'paused';
