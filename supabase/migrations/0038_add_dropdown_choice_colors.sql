-- =============================================================
-- Dropdown choices: add Badge Color + Text Color (Trigger Event)
-- =============================================================
-- The Trigger Event choice table lets each option carry two independently
-- chosen colours, so the value can render as a coloured pill:
--   * badge_color — the pill/background colour key (from CHOICE_COLOR_OPTIONS,
--     e.g. 'blue', 'gold', 'white').
--   * text_color  — the text colour key (same palette).
-- Both nullable so the existing columns (Author/Automation Tags/GHL Tags/GHL
-- Forms) are unaffected; they simply leave these null. Colours are stored as
-- palette KEYS (not hex), resolved to hex app-side.
-- Idempotent DDL; safe to re-run.
-- =============================================================

ALTER TABLE "automation_dropdown_choices" ADD COLUMN IF NOT EXISTS "badge_color" text;
ALTER TABLE "automation_dropdown_choices" ADD COLUMN IF NOT EXISTS "text_color" text;
