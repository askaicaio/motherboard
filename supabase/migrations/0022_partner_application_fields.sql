-- Affiliate onboarding questionnaire + tax form + temp-password flow.
-- The rich questionnaire (how-you-heard, platforms, target audience, experience
-- levels, signature, etc.) lives in application_data jsonb; the few fields the
-- team filters/pays on get first-class columns.

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "tax_form_url" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "tax_form_name" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "date_of_birth" date;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "postal_code" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "audience_size" integer;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "application_data" jsonb NOT NULL DEFAULT '{}'::jsonb;
