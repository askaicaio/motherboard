ALTER TYPE "public"."audit_action" ADD VALUE 'report_archived';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report_unarchived';--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_reports" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "company_reports" ADD CONSTRAINT "company_reports_archived_by_admin_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_reports_archived_at" ON "company_reports" USING btree ("archived_at");