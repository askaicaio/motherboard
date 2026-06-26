-- Flag the seeded sample disputes (so they're badged + excluded from counts),
-- and add an override table for editable email templates (defaults live in code;
-- a row overrides the subject / heading / body for a given template key).

ALTER TABLE "partner_disputes" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
UPDATE "partner_disputes" SET "is_sample" = true WHERE "id" IN (
  'd0000000-0000-0000-0000-00000000e001',
  'd0000000-0000-0000-0000-00000000e002'
);

CREATE TABLE IF NOT EXISTS "partner_email_templates" (
  "key" text PRIMARY KEY,
  "subject" text,
  "heading" text,
  "body_html" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid
);
