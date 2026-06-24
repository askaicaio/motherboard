-- Partner programs: soft-delete ("archive") support + retire Strategic Oversight.
-- Archive is a reversible soft-delete: archived programs disappear from every
-- affiliate-facing surface but stay in the DB so historical conversions and
-- payouts remain intact. Restoring = setting archived_at back to NULL.

ALTER TABLE "partner_programs"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

-- Track who archived/created a program (admin), nullable.
ALTER TABLE "partner_programs"
  ADD COLUMN IF NOT EXISTS "created_by" uuid;

-- Retire the outdated "Strategic Oversight" product (archive, do not delete).
UPDATE "partner_programs"
  SET "archived_at" = now(), "active" = false, "updated_at" = now()
  WHERE "slug" = 'strategic-oversight' AND "archived_at" IS NULL;
