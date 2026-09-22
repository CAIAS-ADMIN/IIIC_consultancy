CREATE TYPE "public"."approval_decision" AS ENUM('verify', 'return', 'reject');--> statement-breakpoint
CREATE TYPE "public"."closure_status" AS ENUM('requested', 'verified', 'clarification_required', 'returned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."confidentiality_level" AS ENUM('public', 'internal', 'confidential', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."consultancy_status" AS ENUM('draft', 'submitted', 'under_verification', 'clarification_required', 'registered', 'active', 'on_hold', 'extension_requested', 'delayed', 'completed_closed', 'cancelled', 'terminated', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."deliverable_completion" AS ENUM('yes', 'partially', 'no');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('uploading', 'scanning', 'available', 'quarantined', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."extension_status" AS ENUM('requested', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('not_started', 'in_progress', 'completed', 'delayed', 'on_hold', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('portal', 'email');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not_invoiced', 'partially_received', 'fully_received', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('on_track', 'delayed', 'on_hold', 'completed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('faculty', 'hod', 'iiic_admin', 'finance', 'competent_authority', 'system_admin', 'audit_readonly');--> statement-breakpoint
CREATE TYPE "public"."workflow_stage" AS ENUM('none', 'hod_verification_pending', 'caias_verification_pending', 'competent_authority_approval_pending', 'verification_complete');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keycloak_sub" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"department_id" uuid,
	"roles" "role"[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_stage_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid,
	"consultancy_area_code" varchar(100),
	"min_value" numeric(14, 2),
	"max_value" numeric(14, 2),
	"stage" varchar(100) NOT NULL,
	"sequence" integer NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"approver_role" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(100) NOT NULL,
	"code" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_code" varchar(50),
	"status" "consultancy_status" DEFAULT 'draft' NOT NULL,
	"workflow_stage" "workflow_stage" DEFAULT 'none' NOT NULL,
	"department_id" uuid NOT NULL,
	"department_coordinator_id" uuid,
	"hod_approver_id" uuid,
	"faculty_in_charge_id" uuid NOT NULL,
	"academic_year_code" varchar(20) NOT NULL,
	"consultancy_type_code" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"consultancy_area_code" varchar(100) NOT NULL,
	"consultancy_area_other" varchar(255),
	"start_date" date,
	"original_completion_date" date,
	"current_completion_date" date,
	"actual_completion_date" date,
	"nda_required" boolean DEFAULT false NOT NULL,
	"ip_agreement_required" boolean DEFAULT false NOT NULL,
	"team_type_code" varchar(100) NOT NULL,
	"external_expert_involved" boolean DEFAULT false NOT NULL,
	"external_expert_details" text,
	"roles_and_responsibilities" text,
	"total_value" numeric(14, 2),
	"currency_code" varchar(10) DEFAULT 'INR' NOT NULL,
	"tax_applicable" boolean DEFAULT false NOT NULL,
	"tax_details" text,
	"estimated_institutional_costs" numeric(14, 2),
	"other_approved_costs" numeric(14, 2),
	"scope_of_work" text,
	"expected_outcomes" text,
	"client_acceptance_required" boolean DEFAULT false NOT NULL,
	"caias_resources_required" boolean DEFAULT false NOT NULL,
	"laboratory_required" boolean DEFAULT false NOT NULL,
	"equipment_required" boolean DEFAULT false NOT NULL,
	"software_required" boolean DEFAULT false NOT NULL,
	"travel_required" boolean DEFAULT false NOT NULL,
	"external_expert_required" boolean DEFAULT false NOT NULL,
	"resource_details" text,
	"estimated_resource_cost" numeric(14, 2),
	"current_version" integer DEFAULT 1 NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"activated_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultancy_departments" (
	"consultancy_id" uuid NOT NULL,
	"department_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultancy_id_sequences" (
	"academic_year_code" varchar(20) PRIMARY KEY NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"organization_name" varchar(255) NOT NULL,
	"organization_type_code" varchar(100) NOT NULL,
	"organization_type_other" varchar(255),
	"industry_sector_code" varchar(100),
	"contact_person_name" varchar(255),
	"designation" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"address" text,
	"website" varchar(500),
	"country_code" varchar(100),
	"state_code" varchar(100),
	"city_code" varchar(100),
	"gstin" varchar(20),
	"pan" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"agreement_type_code" varchar(100) NOT NULL,
	"agreement_type_other" varchar(255),
	"agreement_number" varchar(100),
	"agreement_date" date,
	"agreement_start_date" date,
	"agreement_end_date" date,
	"agreement_value" numeric(14, 2) NOT NULL,
	"payment_terms_code" varchar(100) NOT NULL,
	"payment_terms_other" varchar(255),
	"payment_mode_code" varchar(100),
	"payment_mode_other" varchar(255),
	"number_of_installments" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultancy_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"role" varchar(100) NOT NULL,
	"department" varchar(255),
	"is_external" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"description" text NOT NULL,
	"due_date" date,
	"status" "milestone_status" DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"document_category" varchar(100) NOT NULL,
	"original_file_name" varchar(512) NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"confidentiality_level" "confidentiality_level" DEFAULT 'internal' NOT NULL,
	"status" "document_status" DEFAULT 'uploading' NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"deliverable_id" uuid,
	"title" varchar(255) NOT NULL,
	"planned_date" date NOT NULL,
	"actual_date" date,
	"status" "milestone_status" DEFAULT 'not_started' NOT NULL,
	"responsible_consultant_id" uuid,
	"remarks" text,
	"evidence_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"reporting_period_start" date NOT NULL,
	"reporting_period_end" date NOT NULL,
	"status" "progress_status" NOT NULL,
	"work_completed" text,
	"work_in_progress" text,
	"overall_progress_percent" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"authorised_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"stage_label" varchar(255) NOT NULL,
	"planned_amount" numeric(14, 2) NOT NULL,
	"planned_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"transaction_date" date NOT NULL,
	"institutional_account_ref" varchar(255) NOT NULL,
	"transaction_ref" varchar(255) NOT NULL,
	"tds_deducted" numeric(14, 2) DEFAULT '0' NOT NULL,
	"remarks" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"accepted_by_name" varchar(255) NOT NULL,
	"acceptance_date" date NOT NULL,
	"document_id" uuid,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"feedback_date" date NOT NULL,
	"rating" integer,
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closure_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"closure_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"amount_outstanding" numeric(14, 2) NOT NULL,
	"expected_recovery_action" text NOT NULL,
	"authorising_officer_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"actual_completion_date" date NOT NULL,
	"deliverable_completion_status" "deliverable_completion" NOT NULL,
	"partial_reason" text,
	"final_outcomes" text NOT NULL,
	"final_report_document_id" uuid,
	"status" "closure_status" DEFAULT 'requested' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"stage" varchar(100) NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"decided_by" uuid NOT NULL,
	"comments" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"original_completion_date" date NOT NULL,
	"proposed_completion_date" date NOT NULL,
	"reason" text NOT NULL,
	"revised_timeline" text,
	"client_consent" boolean DEFAULT false NOT NULL,
	"supporting_document_id" uuid,
	"status" "extension_status" DEFAULT 'requested' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"date" date NOT NULL,
	"initiated_by" uuid NOT NULL,
	"financial_status" text NOT NULL,
	"outstanding_obligations" text,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"start_date" date NOT NULL,
	"expected_resume_date" date,
	"actual_resume_date" date,
	"authorised_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"actual_termination_date" date NOT NULL,
	"completed_deliverables" text,
	"outstanding_deliverables" text,
	"financial_status" text NOT NULL,
	"client_communication" text,
	"approved_by" uuid,
	"initiated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor_id" uuid,
	"old_value" jsonb,
	"new_value" jsonb,
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role" "role",
	"consultancy_id" uuid,
	"type" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"channel" "notification_channel" DEFAULT 'portal' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultancy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultancy_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_stage_configs" ADD CONSTRAINT "approval_stage_configs_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data" ADD CONSTRAINT "master_data_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data" ADD CONSTRAINT "master_data_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancies" ADD CONSTRAINT "consultancies_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancies" ADD CONSTRAINT "consultancies_department_coordinator_id_users_id_fk" FOREIGN KEY ("department_coordinator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancies" ADD CONSTRAINT "consultancies_hod_approver_id_users_id_fk" FOREIGN KEY ("hod_approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancies" ADD CONSTRAINT "consultancies_faculty_in_charge_id_users_id_fk" FOREIGN KEY ("faculty_in_charge_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancies" ADD CONSTRAINT "consultancies_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancies" ADD CONSTRAINT "consultancies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancy_departments" ADD CONSTRAINT "consultancy_departments_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancy_departments" ADD CONSTRAINT "consultancy_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancy_team_members" ADD CONSTRAINT "consultancy_team_members_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancy_team_members" ADD CONSTRAINT "consultancy_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_responsible_consultant_id_users_id_fk" FOREIGN KEY ("responsible_consultant_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_authorised_by_users_id_fk" FOREIGN KEY ("authorised_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_acceptances" ADD CONSTRAINT "client_acceptances_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_acceptances" ADD CONSTRAINT "client_acceptances_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_exceptions" ADD CONSTRAINT "closure_exceptions_closure_id_closures_id_fk" FOREIGN KEY ("closure_id") REFERENCES "public"."closures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_exceptions" ADD CONSTRAINT "closure_exceptions_authorising_officer_id_users_id_fk" FOREIGN KEY ("authorising_officer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_final_report_document_id_documents_id_fk" FOREIGN KEY ("final_report_document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_supporting_document_id_documents_id_fk" FOREIGN KEY ("supporting_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_authorised_by_users_id_fk" FOREIGN KEY ("authorised_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminations" ADD CONSTRAINT "terminations_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancy_versions" ADD CONSTRAINT "consultancy_versions_consultancy_id_consultancies_id_fk" FOREIGN KEY ("consultancy_id") REFERENCES "public"."consultancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultancy_versions" ADD CONSTRAINT "consultancy_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_idx" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_keycloak_sub_idx" ON "users" USING btree ("keycloak_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "master_data_category_code_idx" ON "master_data" USING btree ("category","code");--> statement-breakpoint
CREATE UNIQUE INDEX "consultancies_code_idx" ON "consultancies" USING btree ("consultancy_code");--> statement-breakpoint
CREATE INDEX "consultancies_status_idx" ON "consultancies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "consultancies_department_idx" ON "consultancies" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consultancy_departments_pk" ON "consultancy_departments" USING btree ("consultancy_id","department_id");--> statement-breakpoint
CREATE INDEX "clients_consultancy_idx" ON "clients" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "agreements_consultancy_idx" ON "agreements" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "team_members_consultancy_idx" ON "consultancy_team_members" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "deliverables_consultancy_idx" ON "deliverables" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "documents_consultancy_idx" ON "documents" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "documents_category_idx" ON "documents" USING btree ("consultancy_id","document_category");--> statement-breakpoint
CREATE INDEX "milestones_consultancy_idx" ON "milestones" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "progress_updates_consultancy_idx" ON "progress_updates" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "payment_adjustments_consultancy_idx" ON "payment_adjustments" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "payment_schedules_consultancy_idx" ON "payment_schedules" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_consultancy_idx" ON "payment_transactions" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "client_acceptances_consultancy_idx" ON "client_acceptances" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "client_feedback_consultancy_idx" ON "client_feedback" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "closure_exceptions_closure_idx" ON "closure_exceptions" USING btree ("closure_id");--> statement-breakpoint
CREATE INDEX "closures_consultancy_idx" ON "closures" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "approvals_consultancy_idx" ON "approvals" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "extensions_consultancy_idx" ON "extensions" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "cancellations_consultancy_idx" ON "cancellations" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "holds_consultancy_idx" ON "holds" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "terminations_consultancy_idx" ON "terminations" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "audit_events_consultancy_idx" ON "audit_events" USING btree ("consultancy_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_consultancy_idx" ON "notifications" USING btree ("consultancy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consultancy_versions_unique_idx" ON "consultancy_versions" USING btree ("consultancy_id","version_number");