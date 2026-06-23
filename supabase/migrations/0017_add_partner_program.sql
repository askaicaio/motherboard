-- =============================================================
-- Partner Program (affiliate system) — initial schema
-- =============================================================
-- 9 tables + initial seed rows. Idempotent — safe to re-run.
--
-- Architecture mirrors the campaigns feature. Money in integer cents.
-- Rates and windows live in partner_settings (append-only history) so
-- they're never hardcoded — the Terms expressly allow them to change.
-- =============================================================

-- ---- partners --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "partners" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ref_code"        text NOT NULL,
  "name"            text NOT NULL,
  "email"           text NOT NULL,
  "company"         text,
  "status"          text NOT NULL DEFAULT 'applied',
  "tax_form_status" text NOT NULL DEFAULT 'none',
  "payout_method"   text NOT NULL DEFAULT 'none',
  "payout_details"  text,
  "ghl_contact_id"  text,
  "notes"           text,
  "applied_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "approved_at"     timestamp with time zone,
  "approved_by"     uuid REFERENCES "admin_users"("id"),
  "declined_at"     timestamp with time zone,
  "decline_reason"  text,
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"      timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_partners_ref_code" ON "partners"("ref_code");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_partners_email"    ON "partners"("email");
CREATE INDEX        IF NOT EXISTS "idx_partners_status"    ON "partners"("status");
CREATE INDEX        IF NOT EXISTS "idx_partners_ghl"       ON "partners"("ghl_contact_id");

-- ---- partner_settings ------------------------------------------------
CREATE TABLE IF NOT EXISTS "partner_settings" (
  "id"                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cookie_window_days"         integer NOT NULL DEFAULT 60,
  "default_commission_rate"    text    NOT NULL DEFAULT '0.10',
  "refund_window_days"         integer NOT NULL DEFAULT 7,
  "payout_terms_days"          integer NOT NULL DEFAULT 45,
  "min_payout_cents"           integer NOT NULL DEFAULT 10000,
  "effective_from"             timestamp with time zone DEFAULT now() NOT NULL,
  "created_by"                 uuid REFERENCES "admin_users"("id"),
  "created_at"                 timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_partner_settings_effective_from"
  ON "partner_settings"("effective_from");

-- ---- partner_programs ------------------------------------------------
CREATE TABLE IF NOT EXISTS "partner_programs" (
  "id"                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                          text NOT NULL,
  "slug"                          text NOT NULL,
  "list_value_cents"              integer NOT NULL,
  "commission_rate_override"      text,
  "sales_led"                     boolean NOT NULL DEFAULT false,
  "active"                        boolean NOT NULL DEFAULT true,
  "stripe_product_id"             text,
  "stripe_price_id"               text,
  "setup_fee_cents"               integer NOT NULL DEFAULT 0,
  "stripe_fee_passthrough_cents"  integer NOT NULL DEFAULT 0,
  "created_at"                    timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"                    timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_partner_programs_slug" ON "partner_programs"("slug");
CREATE INDEX        IF NOT EXISTS "idx_partner_programs_active" ON "partner_programs"("active");

-- ---- partner_clicks --------------------------------------------------
CREATE TABLE IF NOT EXISTS "partner_clicks" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id"    uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "ref_code"      text NOT NULL,
  "cookie_id"     uuid NOT NULL,
  "ip"            text,
  "user_agent"    text,
  "referrer"      text,
  "landing_path"  text,
  "created_at"    timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_partner_clicks_partner"    ON "partner_clicks"("partner_id");
CREATE INDEX IF NOT EXISTS "idx_partner_clicks_cookie"     ON "partner_clicks"("cookie_id");
CREATE INDEX IF NOT EXISTS "idx_partner_clicks_created_at" ON "partner_clicks"("created_at");

-- ---- partner_attribution_events --------------------------------------
CREATE TABLE IF NOT EXISTS "partner_attribution_events" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id"         uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "type"               text NOT NULL,
  "cookie_id"          uuid,
  "prospect_email"     text,
  "prospect_name"      text,
  "company"            text,
  "source_detail"      text,
  "recorded_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "proposal_sent_at"   timestamp with time zone,
  "is_valid"           boolean NOT NULL DEFAULT true,
  "notes"              text,
  "created_by"         uuid REFERENCES "admin_users"("id"),
  "created_at"         timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_attribution_partner"     ON "partner_attribution_events"("partner_id");
CREATE INDEX IF NOT EXISTS "idx_attribution_email"       ON "partner_attribution_events"("prospect_email");
CREATE INDEX IF NOT EXISTS "idx_attribution_recorded_at" ON "partner_attribution_events"("recorded_at");
CREATE INDEX IF NOT EXISTS "idx_attribution_type"        ON "partner_attribution_events"("type");

-- ---- partner_conversions (the central ledger) ------------------------
CREATE TABLE IF NOT EXISTS "partner_conversions" (
  "id"                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id"                  uuid REFERENCES "partners"("id"),
  "attribution_event_id"        uuid REFERENCES "partner_attribution_events"("id"),
  "buyer_email"                 text NOT NULL,
  "program_id"                  uuid NOT NULL REFERENCES "partner_programs"("id"),

  "gross_cents"                 integer NOT NULL,
  "fees_cents"                  integer NOT NULL DEFAULT 0,
  "non_commissionable_cents"    integer NOT NULL DEFAULT 0,
  "commissionable_cents"        integer NOT NULL,
  "commission_cents"            integer NOT NULL,
  "currency"                    text    NOT NULL DEFAULT 'USD',

  "external_order_id"           text,
  "stripe_session_id"           text,
  "stripe_charge_id"            text,
  "source"                      text    NOT NULL,

  "purchased_at"                timestamp with time zone NOT NULL,
  "is_new_customer"             boolean NOT NULL,
  "status"                      text    NOT NULL DEFAULT 'pending',
  "refund_window_ends_at"       timestamp with time zone NOT NULL,
  "dispute_window_ends_at"      timestamp with time zone NOT NULL,
  "earned_at"                   timestamp with time zone,
  "payout_batch_id"             uuid,

  "reject_reason"               text,
  "public_reject_reason"        text,
  "clawback_of_conversion_id"   uuid REFERENCES "partner_conversions"("id"),

  "created_at"                  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"                  timestamp with time zone DEFAULT now() NOT NULL
);
-- Partial unique on (source, external_order_id) — idempotency for Stripe webhook
-- redeliveries. Manual entries can omit external_order_id; the partial WHERE
-- keeps that path unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_partner_conversions_source_order"
  ON "partner_conversions"("source", "external_order_id")
  WHERE "external_order_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_partner_conversions_status"         ON "partner_conversions"("status");
CREATE INDEX IF NOT EXISTS "idx_partner_conversions_partner"        ON "partner_conversions"("partner_id");
CREATE INDEX IF NOT EXISTS "idx_partner_conversions_buyer_email"    ON "partner_conversions"("buyer_email");
CREATE INDEX IF NOT EXISTS "idx_partner_conversions_refund_ends"    ON "partner_conversions"("refund_window_ends_at");
CREATE INDEX IF NOT EXISTS "idx_partner_conversions_payout_batch"   ON "partner_conversions"("payout_batch_id");
CREATE INDEX IF NOT EXISTS "idx_partner_conversions_clawback_of"    ON "partner_conversions"("clawback_of_conversion_id");

-- ---- partner_conversion_events (append-only audit log) ---------------
CREATE TABLE IF NOT EXISTS "partner_conversion_events" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversion_id"  uuid NOT NULL REFERENCES "partner_conversions"("id") ON DELETE CASCADE,
  "event_type"     text NOT NULL,
  "from_status"    text,
  "to_status"      text,
  "actor_id"       uuid REFERENCES "admin_users"("id"),
  "actor_email"    text,
  "details"        jsonb DEFAULT '{}'::jsonb,
  "occurred_at"    timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_partner_conv_events_conversion"   ON "partner_conversion_events"("conversion_id");
CREATE INDEX IF NOT EXISTS "idx_partner_conv_events_occurred_at"  ON "partner_conversion_events"("occurred_at");
CREATE INDEX IF NOT EXISTS "idx_partner_conv_events_type"         ON "partner_conversion_events"("event_type");

-- ---- customers_index (new-customer gate source of truth) -------------
-- Email is PK. Re-imports use ON CONFLICT DO NOTHING so first_purchase_at
-- is never overwritten by a fresh import after a live conversion has
-- already extended this row.
CREATE TABLE IF NOT EXISTS "customers_index" (
  "email"               text PRIMARY KEY,
  "first_purchase_at"   timestamp with time zone DEFAULT now() NOT NULL,
  "source"              text,
  "notes"               text,
  "created_at"          timestamp with time zone DEFAULT now() NOT NULL
);

-- ---- partner_payout_batches ------------------------------------------
CREATE TABLE IF NOT EXISTS "partner_payout_batches" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "period_yyyymm"  integer NOT NULL,
  "generated_at"   timestamp with time zone DEFAULT now() NOT NULL,
  "status"         text NOT NULL DEFAULT 'draft',
  "total_cents"    integer NOT NULL DEFAULT 0,
  "export_url"     text,
  "generated_by"   uuid REFERENCES "admin_users"("id"),
  "paid_at"        timestamp with time zone,
  "paid_by"        uuid REFERENCES "admin_users"("id")
);
CREATE INDEX IF NOT EXISTS "idx_partner_payout_period" ON "partner_payout_batches"("period_yyyymm");
CREATE INDEX IF NOT EXISTS "idx_partner_payout_status" ON "partner_payout_batches"("status");

-- ---- partner_disputes ------------------------------------------------
CREATE TABLE IF NOT EXISTS "partner_disputes" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id"        uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "conversion_id"     uuid REFERENCES "partner_conversions"("id"),
  "submitted_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "deal_close_date"   timestamp with time zone,
  "evidence"          text,
  "status"            text NOT NULL DEFAULT 'open',
  "resolution"        text,
  "decided_at"        timestamp with time zone,
  "decided_by"        uuid REFERENCES "admin_users"("id")
);
CREATE INDEX IF NOT EXISTS "idx_partner_disputes_partner" ON "partner_disputes"("partner_id");
CREATE INDEX IF NOT EXISTS "idx_partner_disputes_status"  ON "partner_disputes"("status");

-- ---- Seed: initial partner_settings (cookie 60d, 10%, 7d refund, net-45, $100 min) ----
INSERT INTO "partner_settings"
  ("cookie_window_days", "default_commission_rate", "refund_window_days", "payout_terms_days", "min_payout_cents")
SELECT 60, '0.10', 7, 45, 10000
WHERE NOT EXISTS (SELECT 1 FROM "partner_settings");

-- ---- Seed: 6 eligible programs from Landing Page Copy ----------------
INSERT INTO "partner_programs"
  ("name", "slug", "list_value_cents", "sales_led", "active")
VALUES
  ('ROI Blueprint',                'roi-blueprint',                 1000000, false, true),
  ('AI Leadership Certification',  'ai-leadership-certification',   1200000, false, true),
  ('CAIO Certification',           'caio-certification',            1200000, false, true),
  ('AI Leadership Kickstart Day',  'ai-leadership-kickstart-day',   1200000, false, true),
  ('Strategic Oversight',          'strategic-oversight',           4350000, true,  true),
  ('Embedded Fractional CAIO',     'embedded-fractional-caio',      5400000, true,  true)
ON CONFLICT (slug) DO NOTHING;

-- ---- Verify ----------------------------------------------------------
SELECT 'partner_settings rows' AS check_label, COUNT(*) AS n FROM "partner_settings"
UNION ALL
SELECT 'partner_programs rows',                COUNT(*)    FROM "partner_programs";
