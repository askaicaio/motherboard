-- =============================================================
-- Seed: Trigger Event choices (Dropdown Configuration page)
-- =============================================================
-- 15 Trigger Event options, copied verbatim (exact capitalization) from the
-- source dropdown the user provided. Trigger Event is a PLAIN choice column
-- (value only, no Status/Notes), so each row is just the value under
-- column_key = 'trigger_event'. A "Color" column is a future feature (parked),
-- so nothing color-related is seeded here.
--
-- DATA-ONLY seed (the automation_dropdown_choices table already exists). No
-- schema change.
--
-- Re-runnable: ON CONFLICT (column_key, value) DO NOTHING, so re-running only
-- inserts values that are not present yet and NEVER overwrites a row (so a
-- hand-edited option is never clobbered).
-- =============================================================

INSERT INTO "automation_dropdown_choices" ("column_key", "value") VALUES
  ('trigger_event', 'New Form Submission'),
  ('trigger_event', 'Specific Time'),
  ('trigger_event', 'New User Registration'),
  ('trigger_event', 'File Upload'),
  ('trigger_event', 'Webhook Trigger'),
  ('trigger_event', 'New Meeting Creation'),
  ('trigger_event', 'Call Booked'),
  ('trigger_event', 'New Lead'),
  ('trigger_event', 'Watch New Input'),
  ('trigger_event', 'On Demand'),
  ('trigger_event', 'Contact Tag'),
  ('trigger_event', 'Order Submitted'),
  ('trigger_event', 'No Trigger'),
  ('trigger_event', 'Payment Received'),
  ('trigger_event', 'Link Clicked')
ON CONFLICT ("column_key", "value") DO NOTHING;
