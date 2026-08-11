-- 0048_partner_notifications.sql
-- Affiliate-facing in-app notifications (the portal bell). Recipient = an
-- affiliate (partners.id), distinct from staff_notifications (admin) and from
-- partner_notification_settings/subscribers (admin-side program config).
-- Idempotent — safe to run more than once.

CREATE TABLE IF NOT EXISTS partner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link_href text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_notifications_partner
  ON partner_notifications (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_notifications_partner_unread
  ON partner_notifications (partner_id, is_read);
CREATE INDEX IF NOT EXISTS idx_partner_notifications_created_at
  ON partner_notifications (created_at);
