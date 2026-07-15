-- =============================================================
-- Partner programs: add an editable (AI-draftable) marketing description
-- =============================================================
-- Shown on the /enroll checkout cards. Drafted by AI from the admin, then
-- edited + saved by a human. Null = no description. Idempotent.
-- =============================================================

ALTER TABLE "partner_programs" ADD COLUMN IF NOT EXISTS "description" text;
