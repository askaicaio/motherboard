-- =============================================================
-- Partner attribution events: external_ref for atomic webhook dedup
-- =============================================================
-- Booking (GHL) and quiz-lead webhooks can fire the same event repeatedly.
-- external_ref stores the originating event's stable id (GHL appointment id,
-- quiz submission id). A UNIQUE index makes replays a no-op via
-- ON CONFLICT DO NOTHING. Postgres treats NULLs as DISTINCT, so staff-entered
-- rows and webhook rows without an external id (which stay NULL) are never
-- blocked by the constraint. Idempotent.
-- =============================================================

ALTER TABLE "partner_attribution_events"
  ADD COLUMN IF NOT EXISTS "external_ref" text;

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_attribution_external_ref"
  ON "partner_attribution_events" ("external_ref");
