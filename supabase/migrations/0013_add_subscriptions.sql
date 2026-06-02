-- =============================================================
-- Subscriptions — the SaaS / tools spend ledger
-- =============================================================
-- Imported from the legacy ClickUp "Accounts" database. Idempotent;
-- safe to re-run. Seed data lives in
-- supabase/seeds/subscriptions-from-csv-2026-06-02.sql.
-- =============================================================

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_id"       text,
  "name"              text NOT NULL,
  "service_name"      text,
  "owner_email"       text,
  "is_starred"        boolean NOT NULL DEFAULT false,
  "website_url"       text,
  "departments"       text[] NOT NULL DEFAULT '{}',
  "in_one_password"   boolean NOT NULL DEFAULT false,
  "monthly_cost_usd"  numeric(12, 2),
  "annual_cost_usd"   numeric(12, 2),
  "renewal_date"      date,
  "notes"             text,
  "tag"               text,
  "status"            text NOT NULL DEFAULT 'active',
  "archived_at"       timestamp with time zone,
  "archived_by"       uuid REFERENCES "admin_users"("id"),
  "created_by"        uuid REFERENCES "admin_users"("id"),
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"        timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_subscriptions_external_id" ON "subscriptions"("external_id");
CREATE INDEX        IF NOT EXISTS "idx_subscriptions_status"       ON "subscriptions"("status");
CREATE INDEX        IF NOT EXISTS "idx_subscriptions_renewal_date" ON "subscriptions"("renewal_date");
CREATE INDEX        IF NOT EXISTS "idx_subscriptions_archived_at"  ON "subscriptions"("archived_at");
CREATE INDEX        IF NOT EXISTS "idx_subscriptions_owner_email"  ON "subscriptions"("owner_email");
