import { notFound, redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { progressUpdates, milestones, closures, closureExceptions, clientAcceptances } from "@/db/schema";
import { getConsultancyById } from "@/db/queries/consultancies";
import { buildConsultancySnapshot } from "@/lib/consultancy/snapshot";
import { getFinancialSummary } from "@/lib/consultancy/financials";
import { StatusBadge } from "@/components/ui/status-badge";
import { PrintButton } from "@/components/closure/print-button";
import { formatInr } from "@/lib/format";

/**
 * The Closure Record — a clean, print-friendly page (Phase 9 task 5), not a
 * PDF generated server-side: the backend's existing PDF export
 * (`generatePdfSummary`) is built for a multi-row search-results listing, a
 * genuinely different shape than this single record's registration +
 * monitoring + closure + financial detail. The browser's own Print ->
 * Save-as-PDF against this page (app chrome hidden via `print:hidden` on
 * `AppShell`) is what actually satisfies "exportable to PDF" here, with no
 * new backend dependency.
 */
export default async function ClosureRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    notFound();
  }

  const [registration, progress, milestoneRows, closureRows, financial] = await Promise.all([
    buildConsultancySnapshot(db, id),
    db.select().from(progressUpdates).where(eq(progressUpdates.consultancyId, id)).orderBy(asc(progressUpdates.reportDate)),
    db.select().from(milestones).where(eq(milestones.consultancyId, id)).orderBy(asc(milestones.plannedDate)),
    db.select().from(closures).where(eq(closures.consultancyId, id)).orderBy(desc(closures.createdAt)),
    getFinancialSummary(consultancy),
  ]);

  const finalClosure = closureRows.find((c) => c.status === "verified") ?? closureRows[0] ?? null;
  const [exceptionRows, acceptanceRows] = await Promise.all([
    finalClosure ? db.select().from(closureExceptions).where(eq(closureExceptions.closureId, finalClosure.id)) : Promise.resolve([]),
    db.select().from(clientAcceptances).where(eq(clientAcceptances.consultancyId, id)),
  ]);

  const client = registration.client;
  const agreement = registration.agreement;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 print:max-w-none">
      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Closure Record</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {consultancy.consultancyCode ?? "Not registered"} — {consultancy.title}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={consultancy.status} />
          {finalClosure && <StatusBadge status={finalClosure.status} />}
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Registration</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Client</dt>
          <dd className="text-foreground">{client?.organizationName ?? "—"}</dd>
          <dt className="text-muted-foreground">Start Date</dt>
          <dd className="text-foreground">{consultancy.startDate ?? "—"}</dd>
          <dt className="text-muted-foreground">Agreement Value</dt>
          <dd className="text-foreground">{agreement?.agreementValue ? formatInr(Number(agreement.agreementValue)) : "—"}</dd>
          <dt className="text-muted-foreground">Scope of Work</dt>
          <dd className="text-foreground">{consultancy.scopeOfWork ?? "—"}</dd>
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Monitoring</h2>
        <p className="text-sm font-medium text-foreground">Progress Updates ({progress.length})</p>
        <ul className="mb-2 list-inside list-disc text-sm text-foreground">
          {progress.map((p) => (
            <li key={p.id}>
              {p.reportDate} — {p.status.replace(/_/g, " ")}, {p.overallProgressPercent}%
            </li>
          ))}
        </ul>
        <p className="text-sm font-medium text-foreground">Milestones ({milestoneRows.length})</p>
        <ul className="list-inside list-disc text-sm text-foreground">
          {milestoneRows.map((m) => (
            <li key={m.id}>
              {m.title} — planned {m.plannedDate}
              {m.actualDate && `, actual ${m.actualDate}`} ({m.status.replace(/_/g, " ")})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Closure</h2>
        {finalClosure ? (
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Actual Completion Date</dt>
            <dd className="text-foreground">{finalClosure.actualCompletionDate}</dd>
            <dt className="text-muted-foreground">Deliverable Completion</dt>
            <dd className="text-foreground">{finalClosure.deliverableCompletionStatus}</dd>
            <dt className="text-muted-foreground">Final Outcomes</dt>
            <dd className="text-foreground">{finalClosure.finalOutcomes}</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No closure request on record yet.</p>
        )}
        {acceptanceRows.length > 0 && (
          <p className="mt-2 text-sm text-foreground">
            Client accepted by {acceptanceRows[0].acceptedByName} on {acceptanceRows[0].acceptanceDate}
          </p>
        )}
        {exceptionRows.length > 0 && (
          <div className="mt-2 rounded-md border border-border p-3 text-sm">
            <p className="font-medium text-foreground">Financial Exception</p>
            <p className="text-muted-foreground">
              {formatInr(Number(exceptionRows[0].amountOutstanding))} outstanding — {exceptionRows[0].reason}
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-foreground">Financial Summary</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Total Value</dt>
          <dd className="text-foreground">{formatInr(financial.totalValue)}</dd>
          <dt className="text-muted-foreground">Total Received</dt>
          <dd className="text-foreground">{formatInr(financial.totalReceived)}</dd>
          <dt className="text-muted-foreground">Amount Pending</dt>
          <dd className="text-foreground">{formatInr(financial.amountPending)}</dd>
          <dt className="text-muted-foreground">Payment Status</dt>
          <dd>
            <StatusBadge status={financial.paymentStatus} />
          </dd>
        </dl>
      </section>
    </div>
  );
}
