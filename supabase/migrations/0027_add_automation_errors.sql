-- =============================================================
-- Automation errors — captured error events per automation
-- =============================================================
-- One row per error event pulled from an integration (Make first). Feeds the
-- Per Website Error History page (and later the "Last Error" column + the Main
-- Page "Days since last Error" / "# Errors" stats). Linked to an automation
-- (FK, cascade on delete). Capture is made idempotent by the UNIQUE
-- (platform, external_error_id) index, so re-polling the same errored
-- execution updates rather than duplicates. Idempotent DDL; safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS "automation_errors" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "automation_id"     uuid NOT NULL REFERENCES "automations"("id") ON DELETE CASCADE,
  "platform"          text NOT NULL,
  "external_error_id" text NOT NULL,
  "message"           text,
  "occurred_at"       timestamp with time zone NOT NULL,
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_automation_errors_platform_external"
  ON "automation_errors" ("platform", "external_error_id");
CREATE INDEX IF NOT EXISTS "idx_automation_errors_automation"
  ON "automation_errors" ("automation_id");
CREATE INDEX IF NOT EXISTS "idx_automation_errors_platform_time"
  ON "automation_errors" ("platform", "occurred_at");
