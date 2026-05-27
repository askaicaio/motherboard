-- Add an optional company website field to company_reports so the research
-- engine can lock onto the exact prospect (many businesses share names).
ALTER TABLE "company_reports" ADD COLUMN IF NOT EXISTS "company_url" text;
