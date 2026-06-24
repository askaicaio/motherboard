-- =============================================================
-- Partner Program — partner portal auth columns
-- =============================================================
-- Partners log into their own portal with email + password. This auth is
-- ISOLATED from the staff NextAuth session (a separate signed cookie), so
-- a partner never gets a cookie the staff proxy would trust. Idempotent.
-- =============================================================

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "password_token" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "password_token_expires_at" timestamp with time zone;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "portal_last_login_at" timestamp with time zone;
