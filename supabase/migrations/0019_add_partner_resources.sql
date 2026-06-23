-- =============================================================
-- Partner Program — marketing resources (affiliate-facing assets)
-- =============================================================
-- Uploaded files (Vercel Blob → file_url) or linked assets (external_url).
-- Public ones appear on /partners/resources for affiliates. Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS "partner_resources" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title"         text NOT NULL,
  "description"   text,
  "category"      text NOT NULL DEFAULT 'other',
  "file_url"      text,
  "external_url"  text,
  "file_name"     text,
  "mime_type"     text,
  "size_bytes"    integer,
  "is_public"     boolean NOT NULL DEFAULT true,
  "sort_order"    integer NOT NULL DEFAULT 0,
  "archived_at"   timestamp with time zone,
  "created_by"    uuid REFERENCES "admin_users"("id"),
  "created_at"    timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"    timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_partner_resources_category" ON "partner_resources"("category");
CREATE INDEX IF NOT EXISTS "idx_partner_resources_public"   ON "partner_resources"("is_public");
CREATE INDEX IF NOT EXISTS "idx_partner_resources_archived" ON "partner_resources"("archived_at");
