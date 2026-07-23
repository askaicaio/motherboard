-- =============================================================
-- Dropdown Configuration choices — options for the dropdown-driven
-- Per Website automations table columns
-- =============================================================
-- Backs the Automations "Dropdown Configuration" page. Two tables:
--   * automation_dropdown_choices — the selectable options for the four
--     text-style dropdown columns, keyed by `column_key`
--     ('author' | 'automation_tags' | 'ghl_tags' | 'trigger_event'). Unique
--     per (column_key, value) so the same option can't be added twice to one
--     column. GHL Tags choices ('ghl_tags') are surfaced GHL-only in the UI.
--   * automation_webhook_choices — the selectable webhook URLs (kept in its own
--     table because it grows a relationships/junction later). Unique per url.
-- There is NO automation<->choice link yet (single-vs-multi-select is still
-- TBD); that arrives with the Per Website dropdown columns. Idempotent DDL;
-- safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS "automation_dropdown_choices" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "column_key"  text NOT NULL,
  "value"       text NOT NULL,
  "created_by"  uuid REFERENCES "admin_users"("id"),
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now() NOT NULL
);

-- One option per (column, value): the same choice can't be added twice to a column.
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_dropdown_choices_column_value"
  ON "automation_dropdown_choices" ("column_key", "value");
-- Fast per-column reads (one query per table on the Config page).
CREATE INDEX IF NOT EXISTS "idx_dropdown_choices_column"
  ON "automation_dropdown_choices" ("column_key");

CREATE TABLE IF NOT EXISTS "automation_webhook_choices" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "url"         text NOT NULL,
  "created_by"  uuid REFERENCES "admin_users"("id"),
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_webhook_choices_url"
  ON "automation_webhook_choices" ("url");
