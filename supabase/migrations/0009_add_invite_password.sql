ALTER TABLE "admin_users" ADD COLUMN "invite_token" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "invite_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "password_hash" text;