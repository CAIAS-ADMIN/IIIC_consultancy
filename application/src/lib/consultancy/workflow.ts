import { workflowStageEnum, type WorkflowStage } from "@/db/schema/enums";

/** approval_stage_configs.stage is freeform varchar (admin-editable); validate it lands on a real workflow_stage before writing it. */
export function assertWorkflowStage(stage: string): WorkflowStage {
  if (!(workflowStageEnum.enumValues as readonly string[]).includes(stage)) {
    throw new Error(
      `approval_stage_configs.stage "${stage}" is not a valid workflow_stage (expected one of: ${workflowStageEnum.enumValues.join(", ")})`
    );
  }
  return stage as WorkflowStage;
}
