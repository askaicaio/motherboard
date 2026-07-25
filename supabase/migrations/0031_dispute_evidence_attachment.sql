-- =============================================================
-- Partner disputes: optional evidence attachment (PDF or image)
-- =============================================================
-- Affiliates can attach a file (email screenshot, calendar invite, signed
-- intro, etc.) when filing an attribution dispute. Stored URL + original
-- filename; null when no file was uploaded. Idempotent.
-- =============================================================

ALTER TABLE "partner_disputes" ADD COLUMN IF NOT EXISTS "evidence_file_url" text;
ALTER TABLE "partner_disputes" ADD COLUMN IF NOT EXISTS "evidence_file_name" text;
