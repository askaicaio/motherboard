-- =============================================================
-- Automations: Notes column (free-text, mirrors Purpose)
-- =============================================================
-- A second optional free-text note per automation, built exactly like the
-- existing `purpose` column (Purpose-style cell + Add/Edit dialog textarea),
-- shown on the Per Website table immediately to the right of Purpose.
--
--   * notes — nullable free text (stored null when blank). Set only via the
--     Add/Edit Workflow dialog; never written by any platform sync.
--
-- Idempotent DDL; safe to re-run.
-- =============================================================

ALTER TABLE "automations" ADD COLUMN IF NOT EXISTS "notes" text;
