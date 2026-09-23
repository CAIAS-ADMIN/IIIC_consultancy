import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatInr } from "@/lib/format";
import type { PaymentStatus } from "@/db/schema/enums";

/**
 * Read-only for every role, faculty included — the `GET .../financial-summary`
 * route itself has no write path at all, so there's nothing to gate here.
 * The payment-status badge renders exactly what the backend computed
 * (`getFinancialSummary`'s derived `paymentStatus`), never a client-side
 * re-derivation of "is this overdue" from the raw numbers.
 */
export function FinancialSummaryCard({
  totalValue,
  totalReceived,
  amountPending,
  paymentStatus,
}: {
  totalValue: number;
  totalReceived: number;
  amountPending: number;
  paymentStatus: PaymentStatus;
}) {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <StatTile label="Total Value" value={formatInr(totalValue)} tone="primary" />
        <StatTile label="Received" value={formatInr(totalReceived)} />
        <StatTile label="Pending" value={formatInr(amountPending)} tone={amountPending > 0 ? "accent" : "neutral"} />
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Payment Status</p>
          <div>
            <StatusBadge status={paymentStatus} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
