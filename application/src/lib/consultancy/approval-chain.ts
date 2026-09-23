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

  return selectApprovalChain(rows, input);
}

type ApprovalStageConfigRow = typeof approvalStageConfigs.$inferSelect;

/**
 * The matching/dedup half of `resolveApprovalChain`, over config rows already
 * in memory — for callers resolving many consultancies at once (the
 * verification queue), which load the config table once instead of issuing
 * one query per consultancy. Applies every rule itself (required,
 * department/area wildcard-or-match, value range, lowest sequence per
 * stage), so it's safe to pass it the whole unfiltered table.
 */
export function selectApprovalChain(
  configs: ApprovalStageConfigRow[],
  input: { departmentId: string; consultancyAreaCode: string; totalValue: string | number | null }
): ApprovalChainStage[] {
  const value = input.totalValue == null ? 0 : Number(input.totalValue);

  const matching = configs
    .filter(
      (row) =>
        row.isRequired &&
        (row.departmentId == null || row.departmentId === input.departmentId) &&
        (row.consultancyAreaCode == null || row.consultancyAreaCode === input.consultancyAreaCode)
    )
    .filter((row) => {
      const min = row.minValue == null ? -Infinity : Number(row.minValue);
      const max = row.maxValue == null ? Infinity : Number(row.maxValue);
      return value >= min && value <= max;
    })
    .sort((a, b) => a.sequence - b.sequence);

  const byStage = new Map<string, ApprovalChainStage>();
  for (const row of matching) {
    if (!byStage.has(row.stage)) {
      byStage.set(row.stage, { stage: row.stage, approverRole: row.approverRole, sequence: row.sequence });
    }
  }

  return [...byStage.values()].sort((a, b) => a.sequence - b.sequence);
}
