import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { approvalStageConfigs, consultancies, clients, departments } from "@/db/schema";
import type { ConsultancyStatus, Role, WorkflowStage } from "@/db/schema/enums";
import { selectApprovalChain } from "@/lib/consultancy/approval-chain";

const VERIFIABLE_STATUSES = ["submitted", "under_verification"] as const;

export type VerificationQueueItem = {
  id: string;
  consultancyCode: string | null;
  title: string;
  status: ConsultancyStatus;
  workflowStage: WorkflowStage;
  departmentId: string;
  departmentName: string | null;
  clientOrganizationName: string | null;
  requiredRole: Role;
  submittedAt: Date | null;
};

/**
 * Every consultancy currently awaiting a decision at a stage the given user
 * can act on — `system_admin` (the universal override every decision route
 * already honors) sees the whole queue regardless of stage; everyone else
 * sees only items whose *current* stage's configured `approverRole` is one
 * of their roles. The chain (and therefore the current stage) is resolved
 * fresh per consultancy via `resolveApprovalChain`, same as the real verify
 * route — never inferred from `workflow_stage` alone, since that enum value
 * only names the stage, not who approves it (that mapping lives in
 * `approval_stage_configs` and can change without a code deploy).
 *
 * The config table is small and read once per call; each consultancy's chain
 * is then resolved in memory by the same matching rules
 * (`selectApprovalChain`) — one query instead of one per pending item.
 */
export async function getVerificationQueue(user: { roles: Role[] }): Promise<VerificationQueueItem[]> {
  const [pending, configs] = await Promise.all([
    db
      .select({
        id: consultancies.id,
        consultancyCode: consultancies.consultancyCode,
        title: consultancies.title,
        status: consultancies.status,
        workflowStage: consultancies.workflowStage,
        departmentId: consultancies.departmentId,
        consultancyAreaCode: consultancies.consultancyAreaCode,
        totalValue: consultancies.totalValue,
        submittedAt: consultancies.submittedAt,
        departmentName: departments.name,
        clientOrganizationName: clients.organizationName,
      })
      .from(consultancies)
      .leftJoin(departments, eq(departments.id, consultancies.departmentId))
      .leftJoin(clients, eq(clients.consultancyId, consultancies.id))
      .where(inArray(consultancies.status, VERIFIABLE_STATUSES)),
    db.select().from(approvalStageConfigs).orderBy(asc(approvalStageConfigs.sequence)),
  ]);

  const isSystemAdmin = user.roles.includes("system_admin");

  const withStage = pending.map((row) => {
    const chain = selectApprovalChain(configs, {
      departmentId: row.departmentId,
      consultancyAreaCode: row.consultancyAreaCode,
      totalValue: row.totalValue,
    });
    const currentStage = chain.find((s) => s.stage === row.workflowStage);
    return {
      row,
      requiredRole: currentStage?.approverRole as Role | undefined,
    };
  });

  return withStage
    .filter(({ requiredRole }) => requiredRole && (isSystemAdmin || user.roles.includes(requiredRole)))
    .map(({ row, requiredRole }) => ({
      id: row.id,
      consultancyCode: row.consultancyCode,
      title: row.title,
      status: row.status,
      workflowStage: row.workflowStage,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      clientOrganizationName: row.clientOrganizationName,
      requiredRole: requiredRole!,
      submittedAt: row.submittedAt,
    }));
}
