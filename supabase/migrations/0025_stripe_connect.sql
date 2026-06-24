-- Stripe Connect (Express) for automatic affiliate payouts. When an affiliate
-- connects a payout account, the auto-payout flow transfers their earned
-- commission to that connected account instead of leaving it for manual ACH.

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "stripe_connect_account_id" text;
-- none | onboarding | ready | restricted
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "stripe_connect_status" text NOT NULL DEFAULT 'none';
