-- =============================================================
-- Automations — inventory of automations across source websites
-- =============================================================
-- One row per automation (a workflow / scenario / zap), grouped by
-- "platform" (the source website slug: make | n8n | ghl | ghl-b2b | zapier).
-- "external_url" is the automation's identity (the link used to open it on
-- the source site), so it is UNIQUE across the table.
-- Idempotent; safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS "automations" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform"      text NOT NULL,
  "name"          text NOT NULL,
  "external_url"  text NOT NULL,
  "created_by"    uuid REFERENCES "admin_users"("id"),
  "created_at"    timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"    timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_automations_external_url" ON "automations"("external_url");
CREATE INDEX        IF NOT EXISTS "idx_automations_platform"      ON "automations"("platform");
