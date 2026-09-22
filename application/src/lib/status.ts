import type {
  ApprovalDecision,
  ClosureStatus,
  ConfidentialityLevel,
  ConsultancyStatus,
  DeliverableCompletion,
  DocumentStatus,
  ExtensionStatus,
  MilestoneStatus,
  PaymentStatus,
  ProgressStatus,
  WorkflowStage,
} from "@/db/schema/enums";

export type StatusTone = "success" | "warning" | "danger" | "info" | "special" | "neutral";

/**
 * The full union of every status-shaped enum value in the backend schema.
 * `STATUS_STYLES` below is typed as `Record<AnyStatus, StatusTone>` — if a
 * new enum value is ever added to `src/db/schema/enums.ts` without a matching
 * entry here, this file fails to type-check. That's the enforcement
 * mechanism for the Phase 0 acceptance criterion ("no fallback/unknown state
 * left undesigned") — it's a compile error, not a runtime check.
 */
export type AnyStatus =
  | ConsultancyStatus
  | WorkflowStage
  | PaymentStatus
  | MilestoneStatus
  | DocumentStatus
  | ApprovalDecision
  | ProgressStatus
  | DeliverableCompletion
  | ExtensionStatus
  | ClosureStatus
  | ConfidentialityLevel;

export const STATUS_STYLES = {
  // consultancy_status
  draft: "neutral",
  submitted: "warning",
  under_verification: "warning",
  clarification_required: "warning",
  registered: "success",
  active: "success",
  on_hold: "warning",
  extension_requested: "warning",
  delayed: "warning",
  closure_requested: "warning",
  completed_closed: "neutral",
  cancelled: "danger",
  terminated: "danger",
  rejected: "danger",

  // workflow_stage
  none: "neutral",
  hod_verification_pending: "warning",
  caias_verification_pending: "warning",
  competent_authority_approval_pending: "special",
  verification_complete: "success",

  // payment_status
  not_invoiced: "neutral",
  partially_received: "warning",
  fully_received: "success",
  overdue: "danger",

  // milestone_status / progress_status (not_started, in_progress, completed,
  // delayed, on_hold, cancelled — delayed/on_hold/cancelled already above)
  not_started: "neutral",
  in_progress: "info",
  completed: "success",
  on_track: "success",

  // document_status
  uploading: "info",
  scanning: "info",
  available: "success",
  quarantined: "danger",

  // approval_decision
  verify: "success",
  return: "warning",
  reject: "danger",

  // deliverable_completion
  yes: "success",
  partially: "warning",
  no: "danger",

  // extension_status / closure_status (requested, approved, rejected,
  // verified, returned, completed — several already covered above)
  requested: "warning",
  approved: "success",
  verified: "success",
  returned: "warning",

  // confidentiality_level
  public: "info",
  internal: "neutral",
  confidential: "special",
  restricted: "danger",
} satisfies Record<AnyStatus, StatusTone>;

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  danger: "bg-status-danger-bg text-status-danger-fg",
  info: "bg-status-info-bg text-status-info-fg",
  special: "bg-status-special-bg text-status-special-fg",
  neutral: "bg-status-neutral-bg text-status-neutral-fg",
};

export function toneClassesFor(status: AnyStatus): string {
  return TONE_CLASSES[STATUS_STYLES[status]];
}

/** "under_verification" -> "Under Verification", "not_invoiced" -> "Not Invoiced" */
export function humanizeStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
