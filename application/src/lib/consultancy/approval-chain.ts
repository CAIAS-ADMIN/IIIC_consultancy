import { and, asc, eq, isNull, or } from "drizzle-orm";
import { approvalStageConfigs } from "@/db/schema";
import type { Executor } from "@/db";

export type ApprovalChainStage = {
  stage: string;
  approverRole: string;
  sequence: number;
};

/**
 * Resolves the ordered, deduplicated chain of required verification/approval
 * stages for a consultancy from `approval_stage_configs` — read at runtime so
 * which roles approve is never hardcoded (per the build plan). A config row
 * applies when its `departmentId`/`consultancyAreaCode` is null (wildcard) or
 * matches, and the consultancy's value falls within [minValue, maxValue]
 * (null bound = unbounded). When more than one matching row targets the same
 * `stage`, the lowest `sequence` wins — config data is assumed sane, not
 * validated for conflicts here.
 */
export async function resolveApprovalChain(
  executor: Executor,
  input: { departmentId: string; consultancyAreaCode: string; totalValue: string | number | null }
): Promise<ApprovalChainStage[]> {
  const value = input.totalValue == null ? 0 : Number(input.totalValue);

  const rows = await executor
    .select()
    .from(approvalStageConfigs)
    .where(
      and(
        eq(approvalStageConfigs.isRequired, true),
        or(isNull(approvalStageConfigs.departmentId), eq(approvalStageConfigs.departmentId, input.departmentId)),
        or(
          isNull(approvalStageConfigs.consultancyAreaCode),
          eq(approvalStageConfigs.consultancyAreaCode, input.consultancyAreaCode)
        )
      )
    )
    .orderBy(asc(approvalStageConfigs.sequence));

  const inRange = rows.filter((row) => {
    const min = row.minValue == null ? -Infinity : Number(row.minValue);
    const max = row.maxValue == null ? Infinity : Number(row.maxValue);
    return value >= min && value <= max;
  });

  const byStage = new Map<string, ApprovalChainStage>();
  for (const row of inRange) {
    if (!byStage.has(row.stage)) {
      byStage.set(row.stage, { stage: row.stage, approverRole: row.approverRole, sequence: row.sequence });
    }
  }

  return [...byStage.values()].sort((a, b) => a.sequence - b.sequence);
}
