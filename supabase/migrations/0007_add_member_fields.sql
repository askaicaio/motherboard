CREATE TYPE "public"."department" AS ENUM('operations', 'caio_services', 'sales', 'marketing', 'technology', 'social_media', 'podcast_support', 'unassigned');--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "department" "department" DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "archived_by" uuid;