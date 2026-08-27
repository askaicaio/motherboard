-- =============================================================
-- Built-in choices: the "Admin" status + their explanatory Notes
-- =============================================================
-- Follows 0051, which seeded the built-in options themselves.
--
-- 1. STATUS. The two GHL rows were seeded as "Keep" (the least wrong of the
--    four statuses that existed then). They now get their own status, "Admin",
--    which the Add/Edit dialog deliberately does NOT offer: it exists only for
--    these rows. It is also listed first in GHL_TAG_STATUS_OPTIONS, and those
--    two tables group by status order, so this is what lifts the built-ins to
--    the top of their tables.
--
-- 2. NOTES. All four built-ins get a line saying when to pick them, since
--    "No Tag" on its own does not explain itself to the next person. Webhook
--    Links has no Status column, so its two rows are lifted by an explicit
--    sort in the config client instead.
--
-- Idempotent, and deliberately non-destructive: the notes updates only touch
-- rows where notes IS NULL, so a re-run can never overwrite wording someone has
-- since edited by hand. The status update is a plain set, which is safe because
-- "Admin" is not a value anyone can choose in the UI.
-- =============================================================

-- 1. The admin-only status, on the two built-ins that have a Status column.
UPDATE automation_dropdown_choices
SET status = 'Admin', updated_at = now()
WHERE (column_key, value) IN (('ghl_tags', 'No Tag'), ('ghl_forms', 'No Form'));

-- 2. Notes: what each built-in option means, phrased the same way throughout.
UPDATE automation_dropdown_choices
SET notes = 'When the Automation does not use GHL Tags', updated_at = now()
WHERE column_key = 'ghl_tags' AND value = 'No Tag' AND notes IS NULL;

UPDATE automation_dropdown_choices
SET notes = 'When the Automation does not use GHL Forms', updated_at = now()
WHERE column_key = 'ghl_forms' AND value = 'No Form' AND notes IS NULL;

UPDATE automation_webhook_choices
SET notes = 'When a Webhook has no link attached', updated_at = now()
WHERE url = 'No Path' AND notes IS NULL;

UPDATE automation_webhook_choices
SET notes = 'When the Automation does not use Webhooks', updated_at = now()
WHERE url = 'No Webhook' AND notes IS NULL;
