-- ============================================================================
-- 0043_notifications.sql
-- Staff in-app notification inbox + affiliate-program notification config.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- Per-recipient in-app notifications (the sidebar bell).
CREATE TABLE IF NOT EXISTS staff_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link_href   text,
  is_read     boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_user
  ON staff_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_user_unread
  ON staff_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_created_at
  ON staff_notifications(created_at);

-- Global program settings: which event types generate notifications.
CREATE TABLE IF NOT EXISTS partner_notification_settings (
  id         text PRIMARY KEY DEFAULT 'default',
  events     jsonb NOT NULL DEFAULT '["application","message","conversion","dispute"]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure the single settings row exists.
INSERT INTO partner_notification_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Who receives affiliate-program notifications (email opt-in, off by default).
CREATE TABLE IF NOT EXISTS partner_notification_subscribers (
  user_id       uuid PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
