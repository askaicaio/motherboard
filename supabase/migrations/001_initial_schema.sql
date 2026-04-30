-- =============================================================
-- CAIO Internal Dashboard — Initial Schema
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---- Enums ----

CREATE TYPE onboarding_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'provisioning_in_progress',
  'partially_provisioned', 'awaiting_manual_action', 'email_sent',
  'complete', 'failed', 'offboarded'
);

CREATE TYPE tool_provision_status AS ENUM (
  'pending', 'in_progress', 'success', 'failed', 'skipped', 'manual_required'
);

CREATE TYPE division_type AS ENUM ('b2c', 'b2b', 'sales');

CREATE TYPE audit_action AS ENUM (
  'request_created', 'request_updated', 'request_approved', 'request_rejected',
  'provisioning_started', 'provisioning_step_started', 'provisioning_step_completed',
  'provisioning_step_failed', 'provisioning_retried', 'email_generated',
  'email_sent', 'email_resent', 'status_changed', 'rule_created',
  'rule_updated', 'rule_deleted', 'settings_updated', 'manual_override'
);

-- ---- Tables ----

CREATE TABLE admin_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin',
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name         TEXT NOT NULL,
  preferred_name        TEXT,
  employee_email        TEXT NOT NULL,
  personal_email        TEXT,
  phone                 TEXT,
  job_title             TEXT NOT NULL,
  department            TEXT NOT NULL,
  division              division_type NOT NULL,
  manager_name          TEXT,
  manager_email         TEXT,
  start_date            DATE NOT NULL,
  timezone              TEXT,
  employment_type       TEXT,
  location              TEXT,
  onboarding_owner      TEXT,
  work_email_prefix     TEXT,
  notes                 TEXT,
  status                onboarding_status NOT NULL DEFAULT 'draft',
  status_changed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_tools       JSONB NOT NULL DEFAULT '[]',
  slack_channels        JSONB DEFAULT '[]',
  google_groups         JSONB DEFAULT '[]',
  clickup_access_type   TEXT,
  onepassword_vault_profile TEXT,
  manual_override_notes TEXT,
  idempotency_key       TEXT UNIQUE NOT NULL,
  created_by            UUID REFERENCES admin_users(id),
  approved_by           UUID REFERENCES admin_users(id),
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_status ON onboarding_requests(status);
CREATE INDEX idx_onboarding_department ON onboarding_requests(department);
CREATE INDEX idx_onboarding_start_date ON onboarding_requests(start_date);
CREATE INDEX idx_onboarding_created_at ON onboarding_requests(created_at DESC);

CREATE TABLE provisioning_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
  tool_key          TEXT NOT NULL,
  status            tool_provision_status NOT NULL DEFAULT 'pending',
  config            JSONB NOT NULL DEFAULT '{}',
  result_data       JSONB,
  error_message     TEXT,
  attempt_count     INT NOT NULL DEFAULT 0,
  max_attempts      INT NOT NULL DEFAULT 3,
  last_attempted_at TIMESTAMPTZ,
  idempotency_key   TEXT UNIQUE NOT NULL,
  n8n_execution_id  TEXT,
  execution_order   INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, tool_key)
);

CREATE INDEX idx_prov_request ON provisioning_steps(request_id);
CREATE INDEX idx_prov_status ON provisioning_steps(status);

CREATE TABLE provisioning_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  match_department  TEXT,
  match_division    division_type,
  match_job_title   TEXT,
  tool_key          TEXT NOT NULL,
  tool_config       JSONB NOT NULL,
  priority          INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rules_match ON provisioning_rules(match_department, match_division);

CREATE TABLE onboarding_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  html_body     TEXT NOT NULL,
  plain_body    TEXT NOT NULL,
  sent_at       TIMESTAMPTZ,
  sent_to       TEXT NOT NULL,
  resend_count  INT NOT NULL DEFAULT 0,
  message_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_request ON onboarding_emails(request_id);

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      audit_action NOT NULL,
  request_id  UUID REFERENCES onboarding_requests(id) ON DELETE SET NULL,
  actor_id    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_email TEXT,
  details     JSONB NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_request ON audit_logs(request_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);

CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES admin_users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Seed Data ----

-- Default admin user (update email to your actual admin)
INSERT INTO admin_users (email, name, role) VALUES
  ('admin@chiefaiofficer.com', 'CAIO Admin', 'super_admin');

-- Default settings
INSERT INTO app_settings (key, value) VALUES
  ('n8n_base_url', '"https://n8n.example.com"'),
  ('email_from_address', '"onboarding@chiefaiofficer.com"'),
  ('email_from_name', '"CAIO Onboarding"'),
  ('default_max_retries', '3'),
  ('provisioning_timeout_minutes', '30');

-- Sample provisioning rules
INSERT INTO provisioning_rules (name, description, match_department, tool_key, tool_config, priority) VALUES
  ('All employees get Google Workspace', 'Standard Google Workspace account for all new hires', NULL, 'google_workspace', '{"license_type": "Business Standard", "org_unit": "/Employees"}', 0),
  ('All employees get Slack', 'Slack workspace access for all', NULL, 'slack', '{"channels": ["general", "announcements", "watercooler"]}', 0),
  ('Engineering gets ClickUp', 'ClickUp access for engineering team', 'Engineering', 'clickup', '{"role": "member", "spaces": ["Engineering"]}', 10),
  ('Sales gets GoHighLevel', 'GHL access for sales division', NULL, 'gohighlevel', '{"ghl_role": "user"}', 10),
  ('All employees get 1Password', '1Password for credential management', NULL, 'onepassword', '{"vault_names": ["Shared"]}', 0),
  ('Marketing gets Circle', 'Circle community access for marketing', 'Marketing', 'circle', '{"circle_space_groups": ["Team Members"]}', 10);
