-- =============================================================
-- Webhook Links: Notes column + automation<->webhook junction
-- =============================================================
-- Turns the Webhook Links choice table into a 3-column table (Webhook Link |
-- Relationships | Notes):
--
--   1. `notes` on automation_webhook_choices — a free-text note, presented +
--      edited exactly like the GHL Tags / Purpose Notes column. Nullable.
--
--   2. automation_webhooks — the many-to-many link between an automation and the
--      webhook choices it uses. Powers the "Relationships" count (how many
--      automations use each webhook). Webhook Links keeps its OWN junction
--      (points at automation_webhook_choices, a DIFFERENT table from the generic
--      automation_dropdown_selections). Cascades on delete of either side.
--      NOTE: nothing writes to this yet — the Per Website "Webhook Links" column
--      that populates it isn't built, so every Relationships count reads 0 until
--      then. The count query + column are wired now so they light up later.
--
-- Idempotent DDL; safe to re-run.
-- =============================================================

ALTER TABLE "automation_webhook_choices" ADD COLUMN IF NOT EXISTS "notes" text;

CREATE TABLE IF NOT EXISTS "automation_webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "automation_id" uuid NOT NULL REFERENCES "automations"("id") ON DELETE CASCADE,
  "webhook_choice_id" uuid NOT NULL REFERENCES "automation_webhook_choices"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_automation_webhooks"
  ON "automation_webhooks" ("automation_id", "webhook_choice_id");

-- "which automations use this webhook?" (the Relationships count) + cascade cleanup.
CREATE INDEX IF NOT EXISTS "idx_automation_webhooks_choice"
  ON "automation_webhooks" ("webhook_choice_id");

CREATE INDEX IF NOT EXISTS "idx_automation_webhooks_automation"
  ON "automation_webhooks" ("automation_id");
