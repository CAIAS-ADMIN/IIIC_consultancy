import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deliverables, clientAcceptances, closureExceptions, documents } from "@/db/schema";
import { getFinancialSummary } from "./financials";
import type { getConsultancyById } from "@/db/queries/consultancies";
import type { closures } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type ConsultancyRow = NonNullable<Awaited<ReturnType<typeof getConsultancyById>>>;
type ClosureRow = InferSelectModel<typeof closures>;

export type ClosureGateItem = { key: string; label: string; ok: boolean; reason: string | null };
export type ClosureGateResult = { ok: boolean; reasons: string[]; items: ClosureGateItem[] };

/**
 * The closure gate checklist (Phase 10 task 2, frontend Phase 9) — final
 * report uploaded, deliverables recorded, client acceptance present if
 * required, and either the balance is fully received or an authorised
 * exception documents why it isn't. Re-run in full at `verifyClosure`;
 * `requestClosure` separately validates the final report up front so that
 * specific rejection is immediate rather than deferred to verification.
 *
 * Returns both the original flat `ok`/`reasons` (what `verifyClosure`
 * consumes) and a structured `items` list (one row per named gate, each
 * with its own pass/fail + reason) — added for the frontend's Closure Gate
 * Checklist component so it renders the *exact same* checks this function
 * runs, not a re-derived approximation of them.
 */
export async function checkClosureGates(consultancy: ConsultancyRow, closure: ClosureRow): Promise<ClosureGateResult> {
  const items: ClosureGateItem[] = [];

  let finalReportReason: string | null = null;
  if (!closure.finalReportDocumentId) {
    finalReportReason = "Final report document is missing";
  } else {
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, closure.finalReportDocumentId) });
    if (!doc || doc.consultancyId !== consultancy.id || doc.status !== "available") {
      finalReportReason = "Final report document is missing or not available";
    }
  }
  items.push({ key: "final_report", label: "Final Report", ok: finalReportReason === null, reason: finalReportReason });

  const deliverableRows = await db.query.deliverables.findMany({ where: eq(deliverables.consultancyId, consultancy.id) });
  const deliverablesReason = deliverableRows.length === 0 ? "No deliverables are recorded for this consultancy" : null;
  items.push({ key: "deliverables", label: "Deliverables", ok: deliverablesReason === null, reason: deliverablesReason });

  if (consultancy.clientAcceptanceRequired) {
    const acceptance = await db.query.clientAcceptances.findFirst({ where: eq(clientAcceptances.consultancyId, consultancy.id) });
    const reason = acceptance ? null : "Client acceptance is required but not on record";
    items.push({ key: "client_acceptance", label: "Client Acceptance", ok: reason === null, reason });
  }

  const summary = await getFinancialSummary(consultancy);
  let financialReason: string | null = null;
  if (summary.amountPending > 0) {
    const exception = await db.query.closureExceptions.findFirst({ where: eq(closureExceptions.closureId, closure.id) });
    if (!exception) {
      financialReason = `Outstanding balance of ${summary.amountPending.toFixed(2)} has no authorised exception on record`;
    }
  }
  items.push({ key: "financial", label: "Financial Verification", ok: financialReason === null, reason: financialReason });

  const reasons = items.filter((i) => !i.ok).map((i) => i.reason!);
  return { ok: reasons.length === 0, reasons, items };
}
