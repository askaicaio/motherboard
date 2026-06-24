-- Mark seeded/dummy data so it can be badged "SAMPLE ONLY" and excluded from
-- the admin stat tiles (which must always reflect real activity). Plus a
-- configurable payout day-of-month and a $1 test product for end-to-end checks.

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "partner_conversions" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "partner_programs" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "partner_settings" ADD COLUMN IF NOT EXISTS "payout_day_of_month" integer NOT NULL DEFAULT 1;

-- Flag the rows seeded by 0023 as samples.
UPDATE "partners" SET "is_sample" = true WHERE "id" IN (
  'a0000000-0000-0000-0000-00000000d001',
  'a0000000-0000-0000-0000-00000000a002',
  'a0000000-0000-0000-0000-00000000a003',
  'a0000000-0000-0000-0000-00000000a004',
  'a0000000-0000-0000-0000-00000000a005',
  'a0000000-0000-0000-0000-00000000a006'
);
UPDATE "partner_conversions" SET "is_sample" = true WHERE "external_order_id" LIKE 'seed-conv-%';

-- $1 dummy product for testing the checkout → conversion → payout flow.
-- Delete (archive) this before the July 1 launch.
INSERT INTO "partner_programs"
  ("id", "name", "slug", "list_value_cents", "sales_led", "active", "is_sample")
VALUES
  ('f0000000-0000-0000-0000-00000000f001', 'Test Product ($1)', 'test-product-1', 100, false, true, true)
ON CONFLICT ("slug") DO NOTHING;
