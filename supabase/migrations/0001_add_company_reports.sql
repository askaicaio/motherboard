CREATE TYPE "public"."report_stage_status" AS ENUM('pending', 'running', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_title_format" AS ENUM('strategic_growth', 'ebitda_expansion');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_created';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_research_started';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_research_completed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_research_failed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_gamma_started';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_gamma_completed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_gamma_failed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_deleted';--> statement-breakpoint
CREATE TABLE "company_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"industry" text,
	"known_details" text,
	"title_format" "report_title_format" DEFAULT 'strategic_growth' NOT NULL,
	"research_status" "report_stage_status" DEFAULT 'pending' NOT NULL,
	"research_started_at" timestamp with time zone,
	"research_completed_at" timestamp with time zone,
	"research_markdown" text,
	"research_error" text,
	"research_provider" text DEFAULT 'anthropic',
	"research_model" text,
	"research_sources" jsonb DEFAULT '[]'::jsonb,
	"gamma_status" "report_stage_status" DEFAULT 'pending' NOT NULL,
	"gamma_started_at" timestamp with time zone,
	"gamma_completed_at" timestamp with time zone,
	"gamma_generation_id" text,
	"gamma_url" text,
	"gamma_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_reports" ADD CONSTRAINT "company_reports_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_reports_created_at" ON "company_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_reports_research_status" ON "company_reports" USING btree ("research_status");--> statement-breakpoint
CREATE INDEX "idx_reports_gamma_status" ON "company_reports" USING btree ("gamma_status");--> statement-breakpoint
CREATE INDEX "idx_reports_company" ON "company_reports" USING btree ("company_name");