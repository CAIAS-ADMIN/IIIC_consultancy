import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deliverables, clientAcceptances, closureExceptions, documents } from "@/db/schema";
import { getFinancialSummary } from "./financials";
import type { getConsultancyById } from "@/db/queries/consultancies";
import type { closures } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type ConsultancyRow = NonNullable<Awaited<ReturnType<typeof getConsultancyById>>>;
type ClosureRow = InferSelectModel<typeof closures>;

export type ClosureGateResult = { ok: boolean; reasons: string[] };

/**
 * The closure gate checklist (Phase 10 task 2) — final report uploaded,
 * deliverables recorded, client acceptance present if required, and either
 * the balance is fully received or an authorised exception documents why
 * it isn't. Re-run in full at `verifyClosure`; `requestClosure` separately
 * validates the final report up front so that specific rejection is
 * immediate rather than deferred to verification.
 */
export async function checkClosureGates(consultancy: ConsultancyRow, closure: ClosureRow): Promise<ClosureGateResult> {
  const reasons: string[] = [];

  if (!closure.finalReportDocumentId) {
    reasons.push("Final report document is missing");
  } else {
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, closure.finalReportDocumentId) });
    if (!doc || doc.consultancyId !== consultancy.id || doc.status !== "available") {
      reasons.push("Final report document is missing or not available");
    }
  }

  const deliverableRows = await db.query.deliverables.findMany({ where: eq(deliverables.consultancyId, consultancy.id) });
  if (deliverableRows.length === 0) {
    reasons.push("No deliverables are recorded for this consultancy");
  }

  if (consultancy.clientAcceptanceRequired) {
    const acceptance = await db.query.clientAcceptances.findFirst({ where: eq(clientAcceptances.consultancyId, consultancy.id) });
    if (!acceptance) {
      reasons.push("Client acceptance is required but not on record");
    }
  }

  const summary = await getFinancialSummary(consultancy);
  if (summary.amountPending > 0) {
    const exception = await db.query.closureExceptions.findFirst({ where: eq(closureExceptions.closureId, closure.id) });
    if (!exception) {
      reasons.push(`Outstanding balance of ${summary.amountPending.toFixed(2)} has no authorised exception on record`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}
