-- =============================================================
-- Subscriptions: support monthly day-of-month renewals
-- =============================================================
-- For subs billed "every Nth of the month" we want to express the
-- recurrence without anchoring to a specific calendar date. When
-- renewal_day_of_month is set, the UI computes the next occurrence on
-- the fly and ignores renewal_date.
-- =============================================================

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "renewal_day_of_month" integer;
