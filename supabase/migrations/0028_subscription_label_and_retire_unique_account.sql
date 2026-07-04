-- =============================================================
-- Subscriptions: custom label for nested rows + retire a redundant tag
-- =============================================================
-- 1) Add an optional `label` for nested account/seat (child) rows. Children
--    show this label instead of repeating the parent app name; blank = none.
-- 2) Retire the "Unique Account Needed" department tag. Individual accounts
--    are now modeled as child credential rows (parent_id), so flagging the
--    parent with a tag is redundant. Strip it from every row's departments.
-- Idempotent — safe to re-run.
-- =============================================================

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "label" text;

UPDATE "subscriptions"
SET "departments" = array_remove("departments", 'Unique Account Needed')
WHERE 'Unique Account Needed' = ANY ("departments");
