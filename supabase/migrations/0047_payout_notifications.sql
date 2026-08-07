-- 0047_payout_notifications.sql
-- Enable the new "payout" affiliate-program notification event, so staff (Dani
-- + subscribers) get an alert when a payout batch is released via Stripe Connect.
-- Idempotent — safe to run more than once.

-- (a) New installs: include "payout" in the column default.
ALTER TABLE partner_notification_settings
  ALTER COLUMN events
  SET DEFAULT '["application","message","conversion","dispute","payout"]'::jsonb;

-- (b) Existing install: add "payout" to the single 'default' settings row if it
--     exists and doesn't already have it (getEnabledEvents reads this row, so
--     without this the payout alert would be filtered out on the live install).
UPDATE partner_notification_settings
SET events = events || '["payout"]'::jsonb,
    updated_at = now()
WHERE id = 'default'
  AND NOT (events @> '["payout"]'::jsonb);
