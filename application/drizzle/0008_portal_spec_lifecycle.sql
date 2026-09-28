CREATE TABLE "reopenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"previous_status" varchar(50) NOT NULL,
	"new_status" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"supporting_document_id" uuid,
	"authorised_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_acceptances" ALTER COLUMN "accepted_by_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_acceptances" ALTER COLUMN "acceptance_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_stage_configs" ADD COLUMN "consultancy_category_code" varchar(100);--> statement-breakpoint
ALTER TABLE "approval_stage_configs" ADD COLUMN "when_resources_used" boolean;--> statement-breakpoint
ALTER TABLE "approval_stage_configs" ADD COLUMN "when_ip_or_confidential" boolean;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "consultancies" ADD COLUMN "archive_reason" text;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "pending_activities" text;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "challenges" text;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "corrective_action" text;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "next_planned_activity" text;--> statement-breakpoint
ALTER TABLE "client_acceptances" ADD COLUMN "acceptance_status" varchar(20) DEFAULT 'yes' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD COLUMN "suggestions" text;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD COLUMN "recorded_by" uuid;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "final_progress_percent" integer;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "final_outcome" varchar(40);--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "outcome_reason" text;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "deliverable_outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "full_payment_received" boolean;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "amount_pending" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "pending_reason" text;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "expected_payment_date" date;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "declaration_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "finance_verification_status" varchar(20);--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "finance_remarks" text;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "finance_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "finance_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reopenings" ADD CONSTRAINT "reopenings_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reopenings" ADD CONSTRAINT "reopenings_authorised_by_users_id_fk" FOREIGN KEY ("authorised_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reopenings_consultancy_idx" ON "reopenings" USING btree ("consultancy_id");--> statement-breakpoint
ALTER TABLE "consultancies" ADD CONSTRAINT "consultancies_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_finance_verified_by_users_id_fk" FOREIGN KEY ("finance_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;