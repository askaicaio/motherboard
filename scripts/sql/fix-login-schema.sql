-- =============================================================
-- One-paste fix for "can't log in" — applies migrations 0008/0009/0010
-- in a single idempotent script. Safe to re-run.
--
-- HOW TO USE
--   1. Open Supabase → SQL Editor → New query
--   2. Paste this entire file
--   3. Click Run
--
-- WHAT IT DOES
--   - Adds the columns that schema.ts declares but the live DB may be missing
--   - Reports which @chiefaiofficer.com users are currently seeded in
--     admin_users (so you can see whether ced@ / admin@ / doc@ / askai@
--     actually exist there — sign-in fails silently if they don't)
-- =============================================================

-- 0008_add_report_contact -------------------------------------
ALTER TABLE "company_reports" ADD COLUMN IF NOT EXISTS "contact_name"  text;
ALTER TABLE "company_reports" ADD COLUMN IF NOT EXISTS "contact_email" text;
ALTER TABLE "company_reports" ADD COLUMN IF NOT EXISTS "contact_phone" text;

-- 0009_add_invite_password ------------------------------------
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "invite_token"            text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "invite_token_expires_at" timestamp with time zone;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "password_hash"           text;

-- 0010_add_member_profile_fields ------------------------------
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "job_title"  text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "location"   text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "manager_id" uuid;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "phone"      text;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "bio"        text;

-- Diagnostic: who is actually allowed to sign in right now? ---
-- If your account isn't in this list with is_active = true,
-- that is why sign-in is rejected — not the schema.
SELECT id, email, role, department, is_active, last_login_at, created_at
FROM admin_users
WHERE email LIKE '%@chiefaiofficer.com'
ORDER BY created_at;
