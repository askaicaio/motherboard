-- =============================================================
-- Partner messages: chat between an affiliate and the CAIO team
-- =============================================================
-- One append-only thread per partner. senderType 'partner' | 'admin';
-- admin messages carry the author + a display_as ('admin' | 'caio_team').
-- Read-receipt columns drive the two unread counters. Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS "partner_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "sender_type" text NOT NULL,
  "author_admin_id" uuid REFERENCES "admin_users"("id"),
  "author_name" text,
  "display_as" text,
  "body" text NOT NULL,
  "read_by_partner_at" timestamptz,
  "read_by_admin_at" timestamptz,
  "is_sample" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_partner_messages_partner"
  ON "partner_messages" ("partner_id");
CREATE INDEX IF NOT EXISTS "idx_partner_messages_created_at"
  ON "partner_messages" ("created_at");
