-- =============================================================
-- Seed: Automation Tags choices (Dropdown Configuration page)
-- =============================================================
-- 11 Automation Tags options, copied from the source dropdown the user
-- provided (two overlapping screenshots). Names only, NO colours: the user
-- chose to seed the values and set badge/text colours later in Edit mode, so
-- badge_color / text_color are left null here (each renders as plain text until
-- coloured). Each row is the value under column_key = 'automation_tags'.
--
-- NOTE: "None" is a LITERAL tag value here (it appears in the source list as a
-- real tag), not the empty state.
--
-- DATA-ONLY seed (the automation_dropdown_choices table already exists). No
-- schema change.
--
-- Re-runnable: ON CONFLICT (column_key, value) DO NOTHING, so re-running only
-- inserts values that are not present yet and NEVER overwrites a row (so a
-- hand-edited option, e.g. one the user later colours, is never clobbered).
-- =============================================================

INSERT INTO "automation_dropdown_choices" ("column_key", "value") VALUES
  ('automation_tags', 'Meeting Recordings'),
  ('automation_tags', 'Roadshow'),
  ('automation_tags', 'Bookings'),
  ('automation_tags', 'Sales'),
  ('automation_tags', 'Reminders'),
  ('automation_tags', 'Database'),
  ('automation_tags', 'Content Creation'),
  ('automation_tags', 'Webhook'),
  ('automation_tags', 'None'),
  ('automation_tags', 'SMS'),
  ('automation_tags', 'Calls')
ON CONFLICT ("column_key", "value") DO NOTHING;
