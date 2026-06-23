-- =============================================================
-- Partner Program — defense-in-depth: one clawback per conversion
-- =============================================================
-- A refund/chargeback after a PAID commission books a single negative
-- clawback row. Under Stripe's at-least-once + out-of-order webhook
-- delivery, a redelivered refund (or a refund + dispute on the same
-- charge) could otherwise race and insert two negative rows — silently
-- double-clawing-back the partner. The application now serializes this
-- with a FOR UPDATE lock + existing-clawback short-circuit; this partial
-- unique index is the database backstop that makes a second insert
-- impossible even if the application logic regresses.
-- Idempotent — safe to re-run.
-- =============================================================

-- Drop the old plain index if present (replaced by the unique one).
DROP INDEX IF EXISTS "idx_partner_conversions_clawback_of";

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_partner_conversions_clawback_of"
  ON "partner_conversions"("clawback_of_conversion_id")
  WHERE "clawback_of_conversion_id" IS NOT NULL;
