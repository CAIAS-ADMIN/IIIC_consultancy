import { formatInr } from "@/lib/format";
import type { PaymentScheduleRow } from "./payment-schedule-editor";
import type { PaymentTransactionRow } from "./payment-transactions-panel";

/** Planned stages next to actual receipts, both date-sorted — so the two are visually comparable rather than two disconnected lists (Phase 8 task 4). */
export function PaymentComparisonView({
  schedules,
  transactions,
}: {
  schedules: PaymentScheduleRow[];
  transactions: PaymentTransactionRow[];
}) {
  if (schedules.length === 0 && transactions.length === 0) {
    return <p className="text-sm text-muted-foreground">No planned stages or actual payments to compare yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Planned</p>
        {schedules.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
        {schedules.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm">
            <span className="text-foreground">
              {s.stageLabel}
              {s.plannedDate && <span className="text-muted-foreground"> · {s.plannedDate}</span>}
            </span>
            <span className="font-medium text-foreground">{formatInr(Number(s.plannedAmount))}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actual</p>
        {transactions.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
        {transactions.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm">
            <span className="text-foreground">
              {t.transactionRef}
              <span className="text-muted-foreground"> · {t.transactionDate}</span>
            </span>
            <span className="font-medium text-status-success-fg">{formatInr(Number(t.amount))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
