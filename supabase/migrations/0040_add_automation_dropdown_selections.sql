-- =============================================================
-- Automations: multi-select choice junction (Automation Tags first)
-- =============================================================
-- The first of the MULTI-select dropdown columns (Automation Tags) needs a
-- many-to-many link between an automation and the choices it selected. Built
-- GENERICALLY so the other multi-select columns (GHL Tags, GHL Forms) reuse the
-- SAME junction — the column is implied by the linked choice's own column_key
-- in automation_dropdown_choices, so no per-column table is needed.
--
--   * automation_id — FK to automations.id, ON DELETE CASCADE (an automation's
--     selections vanish with it).
--   * choice_id     — FK to automation_dropdown_choices.id, ON DELETE CASCADE
--     (removing a choice on the Dropdown Configuration page un-selects it from
--     every automation, rather than orphaning a dangling id).
--   * UNIQUE (automation_id, choice_id) — a choice is selected at most once per
--     automation (idempotent re-inserts).
--
-- Idempotent DDL; safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS "automation_dropdown_selections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "automation_id" uuid NOT NULL REFERENCES "automations"("id") ON DELETE CASCADE,
  "choice_id" uuid NOT NULL REFERENCES "automation_dropdown_choices"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_automation_dropdown_selections"
  ON "automation_dropdown_selections" ("automation_id", "choice_id");

-- "which tags does this automation have?" (per-row cell read) + the display join.
CREATE INDEX IF NOT EXISTS "idx_automation_dropdown_selections_automation"
  ON "automation_dropdown_selections" ("automation_id");

-- "which automations use this choice?" + cascade cleanup on choice delete.
CREATE INDEX IF NOT EXISTS "idx_automation_dropdown_selections_choice"
  ON "automation_dropdown_selections" ("choice_id");
