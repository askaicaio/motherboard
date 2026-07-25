-- =============================================================
-- Automations: Author column (single-select dropdown)
-- =============================================================
-- The first of the dropdown-driven Per Website columns to get an
-- automation<->choice link. Author is SINGLE-select, so an automation stores
-- ONE reference to its chosen option in `automation_dropdown_choices`
-- (column_key = 'author'); multi-select columns will use junction tables later.
--
--   * author_choice_id — nullable FK to automation_dropdown_choices.id.
--     Nullable because Author is optional (the field defaults to unset). ON
--     DELETE SET NULL so removing an Author option on the Dropdown
--     Configuration page simply un-assigns it from any automation that used it,
--     rather than blocking the delete or orphaning a dangling id.
--
-- Idempotent DDL; safe to re-run.
-- =============================================================

ALTER TABLE "automations"
  ADD COLUMN IF NOT EXISTS "author_choice_id" uuid
  REFERENCES "automation_dropdown_choices"("id") ON DELETE SET NULL;

-- Speeds up "which automations use this author?" style reads (and the display
-- join from an automation to its author value).
CREATE INDEX IF NOT EXISTS "idx_automations_author_choice"
  ON "automations" ("author_choice_id");
