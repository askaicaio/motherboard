-- =============================================================
-- Campaigns: webhook-driven marketing campaign tracking
-- =============================================================
-- Four tables: campaigns, campaign_people (deduped by email),
-- campaign_leads (campaign↔person junction with source attribution),
-- campaign_events (append-only event log for journey timeline).
-- =============================================================

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                text NOT NULL,
  "type"                text NOT NULL DEFAULT 'webinar',
  "description"         text,
  "event_date"          timestamp with time zone,
  "event_timezone"      text DEFAULT 'America/New_York',
  "status"              text NOT NULL DEFAULT 'active',
  "webhook_secret"      text NOT NULL,
  "landing_page_url"    text,
  "ghl_workflow_id"     text,
  "archived_at"         timestamp with time zone,
  "archived_by"         uuid REFERENCES "admin_users"("id"),
  "created_by"          uuid REFERENCES "admin_users"("id"),
  "created_at"          timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"          timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_campaigns_status"        ON "campaigns"("status");
CREATE INDEX IF NOT EXISTS "idx_campaigns_event_date"    ON "campaigns"("event_date");
CREATE INDEX IF NOT EXISTS "idx_campaigns_archived_at"   ON "campaigns"("archived_at");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_campaigns_webhook_secret" ON "campaigns"("webhook_secret");

CREATE TABLE IF NOT EXISTS "campaign_people" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"            text NOT NULL,
  "name"             text,
  "phone"            text,
  "ghl_contact_id"   text,
  "last_activity_at" timestamp with time zone,
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"       timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_campaign_people_email"         ON "campaign_people"("email");
CREATE INDEX        IF NOT EXISTS "idx_campaign_people_last_activity"  ON "campaign_people"("last_activity_at");
CREATE INDEX        IF NOT EXISTS "idx_campaign_people_ghl"            ON "campaign_people"("ghl_contact_id");

CREATE TABLE IF NOT EXISTS "campaign_leads" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id"    uuid NOT NULL REFERENCES "campaigns"("id")        ON DELETE CASCADE,
  "person_id"      uuid NOT NULL REFERENCES "campaign_people"("id")  ON DELETE CASCADE,
  "source"         text,
  "utm_source"     text,
  "utm_medium"     text,
  "utm_campaign"   text,
  "utm_content"    text,
  "utm_term"       text,
  "referer"        text,
  "journey_stage"  text NOT NULL DEFAULT 'registered',
  "registered_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "attended_at"    timestamp with time zone,
  "booked_call_at" timestamp with time zone,
  "created_at"     timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"     timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_campaign_leads_campaign_person" ON "campaign_leads"("campaign_id","person_id");
CREATE INDEX        IF NOT EXISTS "idx_campaign_leads_campaign"         ON "campaign_leads"("campaign_id");
CREATE INDEX        IF NOT EXISTS "idx_campaign_leads_person"           ON "campaign_leads"("person_id");
CREATE INDEX        IF NOT EXISTS "idx_campaign_leads_journey_stage"    ON "campaign_leads"("journey_stage");
CREATE INDEX        IF NOT EXISTS "idx_campaign_leads_utm_source"       ON "campaign_leads"("utm_source");

CREATE TABLE IF NOT EXISTS "campaign_events" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id")       ON DELETE CASCADE,
  "lead_id"     uuid          REFERENCES "campaign_leads"("id")  ON DELETE CASCADE,
  "person_id"   uuid          REFERENCES "campaign_people"("id") ON DELETE CASCADE,
  "event_type"  text NOT NULL,
  "event_data"  jsonb DEFAULT '{}'::jsonb,
  "raw_payload" jsonb,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_campaign_events_campaign"    ON "campaign_events"("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_events_lead"        ON "campaign_events"("lead_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_events_person"      ON "campaign_events"("person_id");
CREATE INDEX IF NOT EXISTS "idx_campaign_events_occurred_at" ON "campaign_events"("occurred_at");
CREATE INDEX IF NOT EXISTS "idx_campaign_events_type"        ON "campaign_events"("event_type");
