-- =============================================================
-- Automation Triage column
-- =============================================================
-- Adds a single-select "Triage" column to the automations table, recording what
-- should HAPPEN to each automation (remove it, keep it, or undecided). Mirrors
-- Author / Trigger Event exactly: a nullable FK to automation_dropdown_choices
-- with column_key = 'triage', ON DELETE SET NULL, resolved for display by a join.
--
-- WHY THESE FIVE VALUES: they are the states already present in the imported
-- Notes text, not an invented vocabulary. 415 of the 418 automations that have
-- notes carry a leading marker in a consistent "STATE - reason" grammar:
--
--     To Remove?   171     Keep?   112     Keep   66
--     To Remove     34     Unknown ("?")    32
--
-- The trailing "?" means probably-but-unconfirmed and is kept as its OWN value
-- (user decision 2026-08-20) rather than being flattened or split into a second
-- "confirmed" flag. The REASON half of each note ("- seems old and unused",
-- "- Incomplete", ...) stays in Notes untouched; this column holds only the state.
--
-- NOTE "Incomplete" is deliberately NOT a value: it appears only as a reason on
-- rows whose state is "To Remove?", never as a state of its own. "Standby" is
-- likewise absent — it occurs nowhere in the data.
--
-- Idempotent — safe to run more than once.
-- =============================================================

-- 1. The column itself. Nullable: a NULL triage means "not yet triaged", which is
--    deliberately DISTINCT from the "Unknown" choice ("looked at, couldn't
--    decide"). The 507 automations with no notes stay NULL after the backfill.
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS triage_choice_id uuid
  REFERENCES automation_dropdown_choices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automations_triage_choice
  ON automations(triage_choice_id);

-- 2. Seed the five options so the column is usable the moment it ships (the
--    Dropdown Configuration page can add/edit/remove them afterwards like any
--    other column). Colours follow the house pale-badge + dark-text convention
--    and run a semantic gradient: red (remove) -> orange (probably remove) ->
--    gray (unknown) -> mint (probably keep) -> green (keep).
--
--    ON CONFLICT DO NOTHING against uniq_dropdown_choices_column_value, so
--    re-running never duplicates a value or clobbers a colour you changed later.
INSERT INTO automation_dropdown_choices (column_key, value, badge_color, text_color)
VALUES
  ('triage', 'To Remove',  'pale-red',    'dark-red'),
  ('triage', 'To Remove?', 'pale-orange', 'dark-orange'),
  ('triage', 'Unknown',    'gray',        'white'),
  ('triage', 'Keep?',      'pale-mint',   'dark-mint'),
  ('triage', 'Keep',       'pale-green',  'dark-green')
ON CONFLICT (column_key, value) DO NOTHING;
