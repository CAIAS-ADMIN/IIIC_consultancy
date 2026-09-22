import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "faculty",
  "hod",
  "iiic_admin",
  "finance",
  "competent_authority",
  "system_admin",
  "audit_readonly",
]);

export type Role = (typeof roleEnum.enumValues)[number];

export const consultancyStatusEnum = pgEnum("consultancy_status", [
  "draft",
  "submitted",
  "under_verification",
  "clarification_required",
  "registered",
  "active",
  "on_hold",
  "extension_requested",
  "delayed",
  "closure_requested",
  "completed_closed",
  "cancelled",
  "terminated",
  "rejected",
]);

export type ConsultancyStatus = (typeof consultancyStatusEnum.enumValues)[number];

export const workflowStageEnum = pgEnum("workflow_stage", [
  "none",
  "hod_verification_pending",
  "caias_verification_pending",
  "competent_authority_approval_pending",
  "verification_complete",
]);

export type WorkflowStage = (typeof workflowStageEnum.enumValues)[number];

export const paymentStatusEnum = pgEnum("payment_status", [
  "not_invoiced",
  "partially_received",
  "fully_received",
  "overdue",
]);

export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "not_started",
  "in_progress",
  "completed",
  "delayed",
  "on_hold",
  "cancelled",
]);

export type MilestoneStatus = (typeof milestoneStatusEnum.enumValues)[number];

export const documentStatusEnum = pgEnum("document_status", [
  "uploading",
  "scanning",
  "available",
  "quarantined",
  "rejected",
]);

export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];

export const confidentialityLevelEnum = pgEnum("confidentiality_level", [
  "public",
  "internal",
  "confidential",
  "restricted",
]);

export type ConfidentialityLevel = (typeof confidentialityLevelEnum.enumValues)[number];

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "verify",
  "return",
  "reject",
]);

export type ApprovalDecision = (typeof approvalDecisionEnum.enumValues)[number];

export const progressStatusEnum = pgEnum("progress_status", [
  "on_track",
  "delayed",
  "on_hold",
  "completed",
]);

export type ProgressStatus = (typeof progressStatusEnum.enumValues)[number];

export const deliverableCompletionEnum = pgEnum("deliverable_completion", [
  "yes",
  "partially",
  "no",
]);

export type DeliverableCompletion = (typeof deliverableCompletionEnum.enumValues)[number];

export const notificationChannelEnum = pgEnum("notification_channel", [
  "portal",
  "email",
]);

export const extensionStatusEnum = pgEnum("extension_status", [
  "requested",
  "approved",
  "rejected",
]);

export type ExtensionStatus = (typeof extensionStatusEnum.enumValues)[number];

export const closureStatusEnum = pgEnum("closure_status", [
  "requested",
  "verified",
  "clarification_required",
  "returned",
  "completed",
]);

export type ClosureStatus = (typeof closureStatusEnum.enumValues)[number];
