-- =============================================================
-- Partner attribution events: scheduled_at (booked appointment time)
-- =============================================================
-- For a booked call, the scheduled appointment time. Powers the affiliate
-- "leads in progress" count: a booking is in-progress until shortly after
-- this time, then it ages out (so an unconverted booking never lingers
-- forever). NULL for events with no appointment. Idempotent.
-- =============================================================

ALTER TABLE "partner_attribution_events"
  ADD COLUMN IF NOT EXISTS "scheduled_at" timestamptz;
