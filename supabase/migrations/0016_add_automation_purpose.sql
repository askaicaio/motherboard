-- =============================================================
-- Automations — add "purpose" column
-- =============================================================
-- Free-text note describing what an automation is for. OPTIONAL (nullable).
-- Surfaced via the "Purpose" column on the Per Website Page table (a "Show"
-- button opens a read-only popup; "None" when empty) and edited in the
-- Add/Edit Workflow dialog. Idempotent; safe to re-run.
-- =============================================================

ALTER TABLE "automations"
  ADD COLUMN IF NOT EXISTS "purpose" text;
