import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import type { Executor, Transaction } from "@/db";
import { paymentTransactions, paymentAdjustments, paymentSchedules } from "@/db/schema";
import { getAgreementByConsultancyId } from "@/db/queries/consultancies";
import type { PaymentStatus } from "@/db/schema/enums";
import type { getConsultancyById } from "@/db/queries/consultancies";

type ConsultancyRow = NonNullable<Awaited<ReturnType<typeof getConsultancyById>>>;

function sumAmounts(rows: { amount: string }[]): number {
  return rows.reduce((total, row) => total + Number(row.amount), 0);
}

export async function getTotalReceived(consultancyId: string, executor: Executor = db): Promise<number> {
  const rows = await executor.query.paymentTransactions.findMany({ where: eq(paymentTransactions.consultancyId, consultancyId) });
  return sumAmounts(rows);
}

export async function getTotalAuthorisedAdjustments(consultancyId: string, executor: Executor = db): Promise<number> {
  const rows = await executor.query.paymentAdjustments.findMany({ where: eq(paymentAdjustments.consultancyId, consultancyId) });
  return sumAmounts(rows);
}

/**
 * `sum(payment_transactions.amount)` may not exceed the agreement value
 * unless an `authorised_adjustment` record raises the ceiling by the same
 * (or greater) amount — checked *before* inserting a new transaction so the
 * ceiling can never be crossed even momentarily. Must run inside the same
 * transaction as the insert, with the consultancy's existing transaction
 * rows locked first (`FOR UPDATE`), so two concurrent recordings can't both
 * pass the check and jointly cross the ceiling.
 */
export async function checkOverpaymentCeiling(
  tx: Transaction,
  consultancyId: string,
  newTransactionAmount: number
): Promise<{ ok: boolean; reason?: string }> {
  const agreement = await getAgreementByConsultancyId(consultancyId);
  if (!agreement) {
    return { ok: false, reason: "No agreement is on record for this consultancy" };
  }

  const existingRows = await tx
    .select({ amount: paymentTransactions.amount })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.consultancyId, consultancyId))
    .for("update");
  const totalReceived = sumAmounts(existingRows);
  const totalAdjustments = await getTotalAuthorisedAdjustments(consultancyId, tx);

  const ceiling = Number(agreement.agreementValue) + totalAdjustments;
  const projectedTotal = totalReceived + newTransactionAmount;
  if (projectedTotal > ceiling) {
    return {
      ok: false,
      reason: `Recording this payment (total would be ${projectedTotal.toFixed(2)}) would exceed the agreement value plus authorised adjustments (${ceiling.toFixed(2)}) — add an authorised adjustment first`,
    };
  }
  return { ok: true };
}

/**
 * `Amount Pending = Total Value − Total Received − Authorised Adjustments`,
 * per the build plan's literal formula. Payment status is derived, not
 * stored: `overdue` takes priority when the cumulative amount planned as due
 * by today (from `payment_schedules`) exceeds what's actually been received
 * and something is still pending; otherwise not_invoiced/partially/fully.
 */
export async function getFinancialSummary(consultancy: ConsultancyRow) {
  const [totalReceived, authorisedAdjustments, schedules] = await Promise.all([
    getTotalReceived(consultancy.id),
    getTotalAuthorisedAdjustments(consultancy.id),
    db.query.paymentSchedules.findMany({ where: eq(paymentSchedules.consultancyId, consultancy.id) }),
  ]);
  return computeFinancialSummary(consultancy.totalValue, { totalReceived, authorisedAdjustments, schedules });
}

export type FinancialSummary = ReturnType<typeof computeFinancialSummary>;

/** The pure half of `getFinancialSummary` — shared with the batched `getFinancialSummaries` so both derive identical numbers and status. */
function computeFinancialSummary(
  totalValueRaw: string | number | null,
  input: { totalReceived: number; authorisedAdjustments: number; schedules: { plannedDate: string | null; plannedAmount: string }[] }
) {
  const { totalReceived, authorisedAdjustments, schedules } = input;
  const totalValue = totalValueRaw == null ? 0 : Number(totalValueRaw);
  const amountPending = totalValue - totalReceived - authorisedAdjustments;

  const today = new Date().toISOString().slice(0, 10);
  const amountDueByNow = schedules
    .filter((s) => s.plannedDate != null && s.plannedDate < today)
    .reduce((sum, s) => sum + Number(s.plannedAmount), 0);

  let paymentStatus: PaymentStatus;
  if (amountPending > 0 && amountDueByNow > totalReceived) {
    paymentStatus = "overdue";
  } else if (totalReceived <= 0) {
    paymentStatus = "not_invoiced";
  } else if (amountPending > 0) {
    paymentStatus = "partially_received";
  } else {
    paymentStatus = "fully_received";
  }

  return {
    totalValue,
    totalReceived,
    authorisedAdjustments,
    amountPending,
    paymentStatus,
  };
}

/** Postgres caps a statement at 65,535 bind parameters; stay well under it. */
const ID_CHUNK = 5000;

async function rowsForIds<T>(ids: string[], fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) out.push(...(await fetch(ids.slice(i, i + ID_CHUNK))));
  return out;
}

/**
 * `getFinancialSummary` for many consultancies at once — three queries in
 * total instead of three per consultancy (the per-row version took ~4s for
 * the institution-wide financial report). Amounts are summed in JS in row
 * order, exactly as `sumAmounts` does, so every figure matches the
 * single-consultancy version bit for bit.
 */
export async function getFinancialSummaries(
  consultancies: { id: string; totalValue: string | number | null }[]
): Promise<Map<string, FinancialSummary>> {
  const ids = consultancies.map((c) => c.id);
  const [transactions, adjustments, schedules] = await Promise.all([
    rowsForIds(ids, (chunk) =>
      db
        .select({ consultancyId: paymentTransactions.consultancyId, amount: paymentTransactions.amount })
        .from(paymentTransactions)
        .where(inArray(paymentTransactions.consultancyId, chunk))
    ),
    rowsForIds(ids, (chunk) =>
      db
        .select({ consultancyId: paymentAdjustments.consultancyId, amount: paymentAdjustments.amount })
        .from(paymentAdjustments)
        .where(inArray(paymentAdjustments.consultancyId, chunk))
    ),
    rowsForIds(ids, (chunk) =>
      db
        .select({
          consultancyId: paymentSchedules.consultancyId,
          plannedDate: paymentSchedules.plannedDate,
          plannedAmount: paymentSchedules.plannedAmount,
        })
        .from(paymentSchedules)
        .where(inArray(paymentSchedules.consultancyId, chunk))
    ),
  ]);

  const group = <T extends { consultancyId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.consultancyId);
      if (list) list.push(row);
      else map.set(row.consultancyId, [row]);
    }
    return map;
  };
  const txBy = group(transactions);
  const adjBy = group(adjustments);
  const schedBy = group(schedules);

  return new Map(
    consultancies.map((c) => [
      c.id,
      computeFinancialSummary(c.totalValue, {
        totalReceived: sumAmounts(txBy.get(c.id) ?? []),
        authorisedAdjustments: sumAmounts(adjBy.get(c.id) ?? []),
        schedules: schedBy.get(c.id) ?? [],
      }),
    ])
  );
}
