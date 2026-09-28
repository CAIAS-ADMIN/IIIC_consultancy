ALTER TABLE "deliverables" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "agreement_signed_status" varchar(50);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "nature_of_consultancy_code" varchar(100);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "nature_of_consultancy_other" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "consultancy_domain_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "consultancy_category_code" varchar(100);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "client_problem" text;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "objective" text;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "reporting_frequency" varchar(50);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "reporting_frequency_other" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "ip_expected" varchar(20);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "ip_type_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "ip_ownership" text;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "ip_commercialisation_rights" text;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "ip_registration_responsibility" text;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "ip_clause_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "confidential_information" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "nda_available" boolean;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "confidentiality_justification" text;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "external_experts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "resource_type_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "resource_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "declaration_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "declaration_accepted_by" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "pin_code" varchar(20);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "contact_department" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "alternate_contact_name" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "alternate_contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "alternate_contact_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "renewal_clause" text;--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "confidentiality_clause" boolean;--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "ip_clause" boolean;--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "payment_terms_included" boolean;--> statement-breakpoint
ALTER TABLE "consultancy_team_members" ADD COLUMN "employee_id" varchar(50);--> statement-breakpoint
ALTER TABLE "consultancy_team_members" ADD COLUMN "designation" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancy_team_members" ADD COLUMN "estimated_hours" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "consultancy_team_members" ADD COLUMN "contribution_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "responsible_consultant" varchar(255);--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "actual_start_date" date;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "responsible_person" varchar(255);--> statement-breakpoint
ALTER TABLE "consultancies" ADD CONSTRAINT "consultancies_declaration_accepted_by_users_id_fk" FOREIGN KEY ("declaration_accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;