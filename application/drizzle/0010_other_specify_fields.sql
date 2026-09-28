ALTER TABLE "consultancies" ADD COLUMN "consultancy_type_other" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "consultancy_domain_other" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "ip_type_other" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "currency_other" varchar(100);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "resource_type_other" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancy_team_members" ADD COLUMN "role_other" varchar(255);--> statement-breakpoint
-- Consultancy Type "Other" and Domain "Other" used to share consultancy_area_other; carry the text over.
UPDATE "consultancies" SET "consultancy_type_other" = "consultancy_area_other" WHERE "consultancy_type_code" = 'other' AND "consultancy_area_other" IS NOT NULL;--> statement-breakpoint
UPDATE "consultancies" SET "consultancy_domain_other" = "consultancy_area_other" WHERE "consultancy_domain_codes" ? 'other' AND "consultancy_area_other" IS NOT NULL;
