import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, documents } from "@/db/schema";
import { getAgreementByConsultancyId } from "@/db/queries/consultancies";
import { resolveApprovalChain } from "./approval-chain";
import type { getConsultancyById } from "@/db/queries/consultancies";

type ConsultancyRow = NonNullable<Awaited<ReturnType<typeof getConsultancyById>>>;

export type ActivationGateResult = { ok: boolean; reasons: string[] };

const MANDATORY_AGREEMENT_DOCUMENT_CATEGORY = "Signed Agreement";
const NDA_DOCUMENT_CATEGORY = "NDA";
const IP_AGREEMENT_DOCUMENT_CATEGORY = "IP Agreement";

async function hasAvailableDocument(consultancyId: string, category: string): Promise<boolean> {
  const row = await db.query.documents.findFirst({
    where: and(eq(documents.consultancyId, consultancyId), eq(documents.documentCategory, category), eq(documents.status, "available")),
  });
  return Boolean(row);
}

/**
 * `activateConsultancy`'s gate — every check is re-verified against real data
 * rather than trusted from `status === "registered"` alone, so activation
 * fails loud with a specific reason (or several) instead of silently.
 */
export async function checkActivationGates(consultancy: ConsultancyRow): Promise<ActivationGateResult> {
  const reasons: string[] = [];

  if (consultancy.status === "active") {
    reasons.push("Consultancy is already active");
  } else if (consultancy.status === "clarification_required") {
    reasons.push("Consultancy has an unresolved clarification request");
  } else if (consultancy.status === "rejected") {
    reasons.push("Consultancy was rejected and cannot be activated");
  } else if (consultancy.status !== "registered") {
    reasons.push(`Consultancy must be 'registered' to activate (currently '${consultancy.status}')`);
  }

  const agreement = await getAgreementByConsultancyId(consultancy.id);
  if (!agreement) {
    reasons.push("Agreement details are missing");
  }
  if (!consultancy.totalValue) {
    reasons.push("Financial total value is missing");
  }
  if (!consultancy.startDate) {
    reasons.push("Start date is missing");
  }
  if (!consultancy.currentCompletionDate) {
    reasons.push("Expected completion date is missing");
  }

  const chain = await resolveApprovalChain(db, {
    departmentId: consultancy.departmentId,
    consultancyAreaCode: consultancy.consultancyAreaCode,
    totalValue: consultancy.totalValue,
  });
  if (chain.length > 0) {
    const verifyRows = await db.query.approvals.findMany({
      where: and(eq(approvals.consultancyId, consultancy.id), eq(approvals.decision, "verify")),
    });
    const verifiedStages = new Set(verifyRows.map((r) => r.stage));
    const missingStages = chain.filter((s) => !verifiedStages.has(s.stage));
    if (missingStages.length > 0) {
      reasons.push(`Not all configured approval stages are complete (missing: ${missingStages.map((s) => s.stage).join(", ")})`);
    }
  }

  if (!(await hasAvailableDocument(consultancy.id, MANDATORY_AGREEMENT_DOCUMENT_CATEGORY))) {
    reasons.push(`Mandatory "${MANDATORY_AGREEMENT_DOCUMENT_CATEGORY}" document is missing`);
  }
  if (consultancy.ndaRequired && !(await hasAvailableDocument(consultancy.id, NDA_DOCUMENT_CATEGORY))) {
    reasons.push(`NDA is required but no "${NDA_DOCUMENT_CATEGORY}" document is available`);
  }
  if (consultancy.ipAgreementRequired && !(await hasAvailableDocument(consultancy.id, IP_AGREEMENT_DOCUMENT_CATEGORY))) {
    reasons.push(`IP Agreement is required but no "${IP_AGREEMENT_DOCUMENT_CATEGORY}" document is available`);
  }

  return { ok: reasons.length === 0, reasons };
}
