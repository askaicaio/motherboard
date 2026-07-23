-- =============================================================
-- Subscriptions: per-seat billing for team plans
-- =============================================================
-- Lets a team subscription record its per-seat price and current seat count
-- (e.g. ChatGPT Business at $25/seat). monthly_cost_usd stays the source of
-- truth for spend totals — it's just derived as seats × per_seat_cost_usd
-- when both are set. Idempotent.
-- =============================================================

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "seats" integer;
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "per_seat_cost_usd" numeric(12, 2);
