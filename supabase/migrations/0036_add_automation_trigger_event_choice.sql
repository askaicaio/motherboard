-- =============================================================
-- Automations: Trigger Event column (single-select dropdown)
-- =============================================================
-- The second single-select dropdown-driven Per Website column (mirrors Author).
-- Each automation stores ONE reference to its chosen option in
-- `automation_dropdown_choices` (column_key = 'trigger_event').
--
--   * trigger_event_choice_id — nullable FK to automation_dropdown_choices.id.
--     Nullable because Trigger Event is optional. ON DELETE SET NULL so removing
--     a Trigger Event option on the Dropdown Configuration page simply
--     un-assigns it from any automation that used it.
--
-- Idempotent DDL; safe to re-run.
-- =============================================================

ALTER TABLE "automations"
  ADD COLUMN IF NOT EXISTS "trigger_event_choice_id" uuid
  REFERENCES "automation_dropdown_choices"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_automations_trigger_event_choice"
  ON "automations" ("trigger_event_choice_id");
