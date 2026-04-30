CREATE TYPE "public"."audit_action" AS ENUM('request_created', 'request_updated', 'request_approved', 'request_rejected', 'provisioning_started', 'provisioning_step_started', 'provisioning_step_completed', 'provisioning_step_failed', 'provisioning_retried', 'email_generated', 'email_sent', 'email_resent', 'status_changed', 'rule_created', 'rule_updated', 'rule_deleted', 'settings_updated', 'manual_override', 'manual_task_created', 'manual_task_completed', 'manual_task_assigned', 'notification_sent', 'offboarding_started', 'offboarding_completed', 'access_profile_created', 'access_profile_updated');--> statement-breakpoint
CREATE TYPE "public"."division_type" AS ENUM('b2c', 'b2b', 'sales');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('onboarding', 'offboarding', 'retry');--> statement-breakpoint
CREATE TYPE "public"."manual_task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('provisioning_complete', 'provisioning_failed', 'manual_task_assigned', 'approval_needed', 'step_retry_needed');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('draft', 'pending_approval', 'approved', 'provisioning_in_progress', 'partially_provisioned', 'awaiting_manual_action', 'email_sent', 'complete', 'failed', 'offboarded');--> statement-breakpoint
CREATE TYPE "public"."provisioning_job_status" AS ENUM('pending', 'running', 'completed', 'partially_failed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tool_provision_status" AS ENUM('pending', 'in_progress', 'success', 'failed', 'skipped', 'manual_required');--> statement-breakpoint
CREATE TABLE "access_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tools" jsonb NOT NULL,
	"tool_configs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_slack_channels" jsonb DEFAULT '[]'::jsonb,
	"default_google_groups" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_profiles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "audit_action" NOT NULL,
	"request_id" uuid,
	"actor_id" uuid,
	"actor_email" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"subject" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "manual_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"step_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"tool_key" text,
	"status" "manual_task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"assigned_to_email" text,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"related_request_id" uuid,
	"related_task_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"plain_body" text NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_to" text NOT NULL,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_name" text NOT NULL,
	"preferred_name" text,
	"employee_email" text NOT NULL,
	"personal_email" text,
	"phone" text,
	"job_title" text NOT NULL,
	"department" text NOT NULL,
	"division" "division_type" NOT NULL,
	"manager_name" text,
	"manager_email" text,
	"start_date" date NOT NULL,
	"timezone" text,
	"employment_type" text,
	"location" text,
	"onboarding_owner" text,
	"work_email_prefix" text,
	"notes" text,
	"status" "onboarding_status" DEFAULT 'draft' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"access_profile_id" uuid,
	"requested_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"slack_channels" jsonb DEFAULT '[]'::jsonb,
	"google_groups" jsonb DEFAULT '[]'::jsonb,
	"clickup_access_type" text,
	"onepassword_vault_profile" text,
	"manual_override_notes" text,
	"idempotency_key" text NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"offboarded_at" timestamp with time zone,
	"offboarded_by" uuid,
	"offboarding_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_requests_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "provisioning_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"status" "provisioning_job_status" DEFAULT 'pending' NOT NULL,
	"job_type" "job_type" NOT NULL,
	"triggered_by" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provisioning_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"match_department" text,
	"match_division" "division_type",
	"match_job_title" text,
	"tool_key" text NOT NULL,
	"tool_config" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provisioning_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"tool_key" text NOT NULL,
	"status" "tool_provision_status" DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_data" jsonb,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_attempted_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"n8n_execution_id" text,
	"execution_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provisioning_steps_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "role_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" text NOT NULL,
	"match_department" text,
	"match_division" "division_type",
	"access_profile_id" uuid,
	"additional_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"additional_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_request_id_onboarding_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."onboarding_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_tasks" ADD CONSTRAINT "manual_tasks_request_id_onboarding_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."onboarding_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_tasks" ADD CONSTRAINT "manual_tasks_step_id_provisioning_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."provisioning_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_tasks" ADD CONSTRAINT "manual_tasks_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_tasks" ADD CONSTRAINT "manual_tasks_completed_by_admin_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_admin_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_request_id_onboarding_requests_id_fk" FOREIGN KEY ("related_request_id") REFERENCES "public"."onboarding_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_task_id_manual_tasks_id_fk" FOREIGN KEY ("related_task_id") REFERENCES "public"."manual_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_emails" ADD CONSTRAINT "onboarding_emails_request_id_onboarding_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."onboarding_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_access_profile_id_access_profiles_id_fk" FOREIGN KEY ("access_profile_id") REFERENCES "public"."access_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_offboarded_by_admin_users_id_fk" FOREIGN KEY ("offboarded_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisioning_jobs" ADD CONSTRAINT "provisioning_jobs_request_id_onboarding_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."onboarding_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisioning_jobs" ADD CONSTRAINT "provisioning_jobs_triggered_by_admin_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisioning_steps" ADD CONSTRAINT "provisioning_steps_request_id_onboarding_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."onboarding_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_rules" ADD CONSTRAINT "role_rules_access_profile_id_access_profiles_id_fk" FOREIGN KEY ("access_profile_id") REFERENCES "public"."access_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_request" ON "audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_manual_task_request" ON "manual_tasks" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_manual_task_status" ON "manual_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_manual_task_assigned" ON "manual_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_notification_recipient" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_notification_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_notification_created" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_email_request" ON "onboarding_emails" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_status" ON "onboarding_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_onboarding_department" ON "onboarding_requests" USING btree ("department");--> statement-breakpoint
CREATE INDEX "idx_onboarding_start_date" ON "onboarding_requests" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_onboarding_created_at" ON "onboarding_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_onboarding_access_profile" ON "onboarding_requests" USING btree ("access_profile_id");--> statement-breakpoint
CREATE INDEX "idx_job_request" ON "provisioning_jobs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_rules_match" ON "provisioning_rules" USING btree ("match_department","match_division");--> statement-breakpoint
CREATE INDEX "idx_prov_request" ON "provisioning_steps" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_prov_status" ON "provisioning_steps" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_prov_request_tool" ON "provisioning_steps" USING btree ("request_id","tool_key");--> statement-breakpoint
CREATE INDEX "idx_role_rules_name" ON "role_rules" USING btree ("role_name");