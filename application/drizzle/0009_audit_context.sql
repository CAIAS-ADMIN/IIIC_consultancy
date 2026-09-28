ALTER TABLE "audit_events" ADD COLUMN "actor_roles" text[];--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "request_ip" varchar(64);--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "user_agent" varchar(512);