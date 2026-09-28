ALTER TABLE "consultancies" ADD COLUMN "tax_rate_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "tax_amount" numeric(14, 2);