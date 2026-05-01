ALTER TABLE "company_reports" ADD COLUMN "research_input_tokens" integer;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "research_output_tokens" integer;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "research_cache_read_tokens" integer;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "research_cache_creation_tokens" integer;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "research_web_search_count" integer;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "research_cost_usd" text;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "research_thinking_summary" text;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "gamma_credits_deducted" integer;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "gamma_credits_remaining" integer;