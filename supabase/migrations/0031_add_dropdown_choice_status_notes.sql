-- =============================================================
-- Dropdown choices: add Status + Notes (for the GHL Tags Config table)
-- =============================================================
-- The GHL Tags table on the Dropdown Configuration page grows two extra
-- columns (the other four choice tables leave them null):
--   * status — one of 'Keep' | 'To Remove' | 'Unknown' | 'Removed'. New GHL Tag
--     entries default to 'Unknown' (set app-side). Fixed 4-option dropdown.
--   * notes  — free text, presented + edited like the Per Website "Purpose"
--     column.
-- Both nullable so the existing single-column tables are unaffected.
-- Idempotent DDL; safe to re-run.
-- =============================================================

ALTER TABLE "automation_dropdown_choices" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE "automation_dropdown_choices" ADD COLUMN IF NOT EXISTS "notes" text;
