-- =============================================================
-- Special (built-in) dropdown choices: "No Tag", "No Form", "No Webhook"
-- =============================================================
-- Seeds the three new "there is nothing to pick here" options, matching the
-- existing "No Path" row on Webhook Links (which was hand-inserted long ago for
-- exactly the same reason).
--
-- WHY THEY ARE SEEDED HERE rather than added through the UI: the Dropdown
-- Configuration page's Add Option form validates Webhook Links entries as real
-- URLs, so "No Path" and "No Webhook" cannot be typed in. The GHL Tags / GHL
-- Forms ones COULD be, but seeding all three together keeps one rule: a special
-- option exists because a migration put it there, never because someone typed
-- it. The app-side registry that recognises these values lives in
-- `src/lib/automations/dropdown-config.ts` (SPECIAL_CHOICES); both halves are
-- required, and deleting or renaming these rows is blocked in the API.
--
-- Idempotent: ON CONFLICT DO NOTHING against each table's unique index, so a
-- re-run is a no-op and an already-present value (like "No Path") is untouched.
-- created_by is left NULL: nobody authored these, the system did.
-- =============================================================

-- GHL Tags + GHL Forms live in the generic choices table, keyed by column_key.
-- Status "Keep" because these options are permanent by design; "Unknown" (the
-- default for a newly added choice) would be actively misleading on a row that
-- is never going away, and "To Remove" would be nonsense.
INSERT INTO automation_dropdown_choices (column_key, value, status)
VALUES
  ('ghl_tags',  'No Tag',  'Keep'),
  ('ghl_forms', 'No Form', 'Keep')
ON CONFLICT (column_key, value) DO NOTHING;

-- Webhook Links keeps its own table, so its special option is a row whose
-- "url" is not a URL at all. Exactly how "No Path" already sits in there.
INSERT INTO automation_webhook_choices (url)
VALUES ('No Webhook')
ON CONFLICT (url) DO NOTHING;
