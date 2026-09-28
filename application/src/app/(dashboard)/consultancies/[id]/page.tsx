import { FileDown } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  departments,
  deliverables,
  approvals,
  consultancyVersions,
  progressUpdates,
  milestones,
  users,
  extensions,
  holds,
  cancellations,
  terminations,
  paymentSchedules,
  paymentTransactions,
  paymentAdjustments,
  closures,
  clientAcceptances,
  clientFeedback,
  reopenings,
} from "@/db/schema";
import { getConsultancyById, getClientByConsultancyId, getAgreementByConsultancyId } from "@/db/queries/consultancies";
import { listMasterData } from "@/db/queries/master-data";
import { listDocumentsForConsultancy } from "@/db/queries/documents";
import { getConsultancyDerivedFields } from "@/db/queries/consultancy-derived";
import { resolveApprovalChain, approvalChainInputFor } from "@/lib/consultancy/approval-chain";
import { checkActivationGates } from "@/lib/consultancy/activation";
import { checkClosureGates } from "@/lib/consultancy/closure-gates";
import { canViewConsultancy, isConsultancyMember, isOutOfDepartmentHod } from "@/lib/consultancy/access";
import { SEND_BACK_STATUSES } from "@/lib/validation/lifecycle";
import { getRegistrationRecord } from "@/db/queries/registration-record";
import { FINANCIAL_AUDIT_ENTITY_TYPES, listAuditEvents } from "@/db/queries/audit";
import { RegistrationDetails } from "@/components/consultancy/registration-details";
import { AuditTrailList } from "@/components/consultancy/audit-trail-list";
import { DocumentRepository } from "@/components/documents/document-repository";
import { FinanceClosurePanel } from "@/components/closure/finance-closure-panel";
import { RecordAdminActions } from "@/components/consultancy/record-admin-actions";
import { ARCHIVABLE_STATUSES } from "@/lib/validation/lifecycle";
import { getFinancialSummary } from "@/lib/consultancy/financials";
import { FLAGGABLE_FIELDS } from "@/lib/consultancy/flaggable-fields";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { VerificationActions } from "@/components/verification/verification-actions";
import { ClarificationEditor } from "@/components/verification/clarification-editor";
import { ActivationPanel } from "@/components/consultancy/activation-panel";
import { DerivedFieldsStrip } from "@/components/consultancy/derived-fields-strip";
import { ProgressUpdatesPanel } from "@/components/consultancy/progress-updates-panel";
import { MilestonesPanel } from "@/components/consultancy/milestones-panel";
import { LifecycleActions } from "@/components/consultancy/lifecycle-actions";
import { ExtensionDecisionPanel } from "@/components/consultancy/extension-decision-panel";
import { OnHoldBanner, TerminalStateBanner } from "@/components/consultancy/lifecycle-banners";
import { FinancialSummaryCard } from "@/components/financials/financial-summary-card";
import { PaymentScheduleEditor } from "@/components/financials/payment-schedule-editor";
import { PaymentTransactionsPanel } from "@/components/financials/payment-transactions-panel";
import { PaymentAdjustmentsPanel } from "@/components/financials/payment-adjustments-panel";
import { PaymentComparisonView } from "@/components/financials/payment-comparison-view";
import { ClosureGateChecklist } from "@/components/closure/closure-gate-checklist";
import { ClosureExceptionForm } from "@/components/closure/closure-exception-form";
import { ClientFeedbackPanel } from "@/components/closure/client-acceptance-form";
import { RequestClosureDialog } from "@/components/closure/request-closure-dialog";
import { ClosureVerifyActions } from "@/components/closure/closure-verify-actions";
import Link from "next/link";
import { formatInr } from "@/lib/format";
import type { Role } from "@/db/schema/enums";

const VERIFIABLE_STATUSES = ["submitted", "under_verification"];
const ACTIVATED_STATUSES = ["active", "on_hold", "extension_requested", "delayed", "closure_requested", "completed_closed"];
/** Matches `cancel`/`terminate` routes' own `TERMINAL_STATUSES` exactly. */
const CANCEL_TERMINATE_BLOCKED_STATUSES = ["cancelled", "terminated", "completed_closed", "rejected", "draft"];

const SECTION_NAV = [
  { id: "overview", label: "Overview" },
  { id: "registration", label: "Registration Details" },
  { id: "financials", label: "Payments" },
  { id: "documents", label: "Documents" },
  { id: "progress-milestones", label: "Progress & Milestones" },
  { id: "client-feedback", label: "Client Feedback" },
  { id: "history", label: "History" },
  { id: "audit-trail", label: "Audit Trail" },
];

/** Statuses in which client acceptance / feedback can be recorded. */
const FEEDBACK_STATUSES = ["active", "delayed", "closure_requested", "completed_closed"];

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value || "—"}</dd>
    </div>
  );
}

function masterLabel(options: { code: string; label: string }[], code: string | null | undefined): string {
  if (!code) return "—";
  return options.find((o) => o.code === code)?.label ?? code;
}

export default async function ConsultancyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    notFound();
  }

  const isOwner = consultancy.createdBy === session.user.id || consultancy.facultyInChargeId === session.user.id;
  const isElevated =
    session.user.roles.some((r) => ["iiic_admin", "system_admin"].includes(r)) ||
    (session.user.roles.includes("hod") && Boolean(session.user.departmentId) && session.user.departmentId === consultancy.departmentId);

  // Phase 3's one addition ahead of this phase: a still-draft record redirects
  // its owner straight back into the registration wizard instead of a dead
  // end. Everything below this is the real review page: Phase 5's
  // verification decision flow plus Phase 6's activation/execution sections.
  if (consultancy.status === "draft") {
    if (isOwner || isElevated) {
      redirect(`/consultancies/new?draft=${id}`);
    }
    notFound();
  }

  const authedUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    roles: session.user.roles,
    departmentId: session.user.departmentId,
  };
  if (!(await canViewConsultancy(authedUser, consultancy))) {
    notFound();
  }

  const [
    client,
    agreement,
    deliverableRows,
    mainDepartment,
    masterDataRows,
    documentRows,
    approvalRows,
    versionRows,
    progressUpdateRows,
    milestoneRows,
    derived,
    canRecordProgress,
  ] = await Promise.all([
    getClientByConsultancyId(id),
    getAgreementByConsultancyId(id),
    db.query.deliverables.findMany({ where: eq(deliverables.consultancyId, id) }),
    db.query.departments.findFirst({ where: eq(departments.id, consultancy.departmentId) }),
    listMasterData(),
    listDocumentsForConsultancy(id),
    db.query.approvals.findMany({ where: eq(approvals.consultancyId, id), orderBy: (row, { desc }) => [desc(row.decidedAt)] }),
    db.query.consultancyVersions.findMany({ where: eq(consultancyVersions.consultancyId, id), orderBy: [asc(consultancyVersions.versionNumber)] }),
    db.query.progressUpdates.findMany({ where: eq(progressUpdates.consultancyId, id), orderBy: [asc(progressUpdates.reportDate)] }),
    db
      .select({
        id: milestones.id,
        title: milestones.title,
        description: milestones.description,
        startDate: milestones.startDate,
        plannedDate: milestones.plannedDate,
        actualStartDate: milestones.actualStartDate,
        actualDate: milestones.actualDate,
        status: milestones.status,
        remarks: milestones.remarks,
        responsibleName: users.name,
        responsiblePerson: milestones.responsiblePerson,
      })
      .from(milestones)
      .leftJoin(users, eq(users.id, milestones.responsibleConsultantId))
      .where(eq(milestones.consultancyId, id))
      .orderBy(asc(milestones.plannedDate)),
    getConsultancyDerivedFields(consultancy),
    isConsultancyMember(authedUser, consultancy),
  ]);

  const [extensionRows, holdRows, cancellationRows, terminationRows] = await Promise.all([
    db.query.extensions.findMany({ where: eq(extensions.consultancyId, id), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
    db.query.holds.findMany({ where: eq(holds.consultancyId, id), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
    db.query.cancellations.findMany({ where: eq(cancellations.consultancyId, id) }),
    db.query.terminations.findMany({ where: eq(terminations.consultancyId, id) }),
  ]);

  const [financialSummary, scheduleRows, transactionRows, adjustmentRows] = await Promise.all([
    getFinancialSummary(consultancy),
    db.query.paymentSchedules.findMany({ where: eq(paymentSchedules.consultancyId, id), orderBy: [asc(paymentSchedules.plannedDate)] }),
    db.query.paymentTransactions.findMany({ where: eq(paymentTransactions.consultancyId, id), orderBy: [asc(paymentTransactions.transactionDate)] }),
    db.query.paymentAdjustments.findMany({ where: eq(paymentAdjustments.consultancyId, id), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
  ]);

  const [closureRows, clientAcceptanceRows, feedbackRows, registrationRecord, reopeningRows] = await Promise.all([
    db.query.closures.findMany({ where: eq(closures.consultancyId, id), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
    db.query.clientAcceptances.findMany({ where: eq(clientAcceptances.consultancyId, id), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
    db.query.clientFeedback.findMany({ where: eq(clientFeedback.consultancyId, id), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
    getRegistrationRecord(id),
    db.query.reopenings.findMany({ where: eq(reopenings.consultancyId, id), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
  ]);

  // Audit trail scope: oversight roles see everything; Finance sees the financial
  // trail; faculty (the record's own team included) don't get an audit section.
  const roles = session.user.roles;
  const seesFullAudit = roles.some((r) => ["hod", "iiic_admin", "competent_authority", "system_admin", "audit_readonly"].includes(r));
  const seesFinancialAudit = !seesFullAudit && roles.includes("finance");
  const auditEventsForRecord =
    seesFullAudit || seesFinancialAudit
      ? (await listAuditEvents({ consultancyId: id, entityTypes: seesFinancialAudit ? FINANCIAL_AUDIT_ENTITY_TYPES : undefined }, { limit: 200, offset: 0 })).rows
      : null;
  const pendingClosure = closureRows.find((c) => c.status === "requested") ?? null;
  const closureGate = pendingClosure ? await checkClosureGates(consultancy, pendingClosure) : null;

  const masterData: Record<string, { code: string; label: string }[]> = {};
  for (const row of masterDataRows) {
    (masterData[row.category] ??= []).push({ code: row.code, label: row.label });
  }

  const existingDocumentCategories = [...new Set(documentRows.map((d) => d.documentCategory))];
  const pinnedDocumentCategories = [
    "Signed Agreement",
    ...(consultancy.ndaRequired ? ["NDA"] : []),
    ...(consultancy.ipAgreementRequired ? ["IP Agreement"] : []),
  ];

  let requiredRole: Role | null = null;
  if (VERIFIABLE_STATUSES.includes(consultancy.status)) {
    const chain = await resolveApprovalChain(db, approvalChainInputFor(consultancy));
    const currentStage = chain.find((s) => s.stage === consultancy.workflowStage);
    requiredRole = (currentStage?.approverRole as Role) ?? null;
  }
  const canAct =
    requiredRole !== null &&
    (session.user.roles.includes(requiredRole) || session.user.roles.some((r) => ["iiic_admin", "system_admin"].includes(r))) &&
    !isOutOfDepartmentHod(authedUser, consultancy);

  const canActivate = session.user.roles.some((r) => ["iiic_admin", "system_admin"].includes(r));
  const activationGate = consultancy.status === "registered" && canActivate ? await checkActivationGates(consultancy) : null;

  const latestReturnComment = approvalRows.find((a) => a.decision === "return")?.comments ?? null;
  const overdueIds = new Set(derived.overdueMilestones.map((m) => m.id));

  // Lifecycle actions (Phase 7) — role lists copied exactly from each route's
  // own `requireRole(...)` call, never approximated, so a button's presence
  // here always matches what the backend would actually accept.
  const canDecideLifecycle = session.user.roles.some((r) => ["hod", "iiic_admin", "competent_authority", "system_admin"].includes(r));
  const canManageHold = session.user.roles.some((r) => ["hod", "iiic_admin", "system_admin"].includes(r));
  const canCancelOrTerminate = canDecideLifecycle && !CANCEL_TERMINATE_BLOCKED_STATUSES.includes(consultancy.status);
  // No oversight-role override here, deliberately — "Finance role has exclusive write access to payment records" (matches every payment route's own `requireRole("finance")`, no `system_admin` fallback).
  const canManagePayments = session.user.roles.includes("finance");

  // Closure workflow (Phase 9) — role lists copied from the closure routes' own `requireRole(...)` calls.
  const canRequestClosure = consultancy.status === "active" && canRecordProgress;
  const canAuthoriseException = session.user.roles.some((r) =>
    ["finance", "hod", "iiic_admin", "competent_authority", "system_admin"].includes(r)
  );
  const canVerifyClosure = session.user.roles.some((r) => ["iiic_admin", "system_admin"].includes(r));
  const canRecordAcceptance = ["active", "closure_requested"].includes(consultancy.status) && canRecordProgress;
  const canRecordFeedback = FEEDBACK_STATUSES.includes(consultancy.status) && canRecordProgress;
  const isFinance = session.user.roles.includes("finance");
  const isCaiasAdmin = session.user.roles.some((r) => ["iiic_admin", "system_admin"].includes(r));
  const canReopen = isCaiasAdmin && !consultancy.archivedAt && ["rejected", "completed_closed"].includes(consultancy.status);
  const canArchive = isCaiasAdmin && (ARCHIVABLE_STATUSES as readonly string[]).includes(consultancy.status);
  const canSendBack = isCaiasAdmin && (SEND_BACK_STATUSES as readonly string[]).includes(consultancy.status);
  const pendingExtension = extensionRows.find((e) => e.status === "requested") ?? null;
  const openHold = holdRows.find((h) => h.actualResumeDate === null) ?? null;
  const terminalRecord = cancellationRows[0]
    ? { reason: cancellationRows[0].reason, date: cancellationRows[0].date }
    : terminationRows[0]
      ? { reason: terminationRows[0].reason, date: terminationRows[0].actualTerminationDate }
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={consultancy.title}
        subtitle={consultancy.consultancyCode ?? "Not yet registered"}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={consultancy.status} />
            {consultancy.workflowStage !== "none" && <StatusBadge status={consultancy.workflowStage} />}
          </div>
        }
      />

      {ACTIVATED_STATUSES.includes(consultancy.status) && (
        <DerivedFieldsStrip
          daysElapsed={derived.daysElapsed}
          daysRemaining={derived.daysRemaining}
          isCompletionOverdue={derived.isCompletionOverdue}
        />
      )}

      {consultancy.archivedAt && (
        <div role="status" className="rounded-md bg-status-neutral-bg p-3 text-sm text-status-neutral-fg">
          Archived on {new Date(consultancy.archivedAt).toLocaleDateString("en-IN")}
          {consultancy.archiveReason && ` — ${consultancy.archiveReason}`}. The record remains fully available for audit.
        </div>
      )}

      <RecordAdminActions consultancyId={id} canSendBack={canSendBack} canReopen={canReopen} canArchive={canArchive} isArchived={Boolean(consultancy.archivedAt)} />

      {canAct && requiredRole && <VerificationActions consultancyId={id} flaggableFields={FLAGGABLE_FIELDS} />}

      {activationGate && <ActivationPanel consultancyId={id} reasons={activationGate.reasons} />}

      {consultancy.status === "on_hold" && openHold && (
        <OnHoldBanner reason={openHold.reason} expectedResumeDate={openHold.expectedResumeDate} />
      )}

      {(consultancy.status === "cancelled" || consultancy.status === "terminated") && terminalRecord && (
        <TerminalStateBanner
          status={consultancy.status}
          reason={terminalRecord.reason}
          date={terminalRecord.date}
        />
      )}

      {pendingExtension && canDecideLifecycle && (
        <ExtensionDecisionPanel consultancyId={id} extension={pendingExtension} />
      )}

      <LifecycleActions
        consultancyId={id}
        status={consultancy.status}
        canRequestExtension={consultancy.status === "active" && canRecordProgress && !pendingExtension}
        canManageHold={canManageHold}
        canCancelOrTerminate={canCancelOrTerminate}
      />

      {canRequestClosure && (
        <RequestClosureDialog
          consultancyId={id}
          startDate={consultancy.startDate}
          deliverables={deliverableRows.map((d) => ({ id: d.id, name: d.name ?? d.description ?? "Deliverable", dueDate: d.dueDate }))}
          financial={financialSummary}
        />
      )}

      {pendingClosure && closureGate && (
        <div className="flex flex-col gap-3">
          {canVerifyClosure && <ClosureVerifyActions consultancyId={id} closureId={pendingClosure.id} gateOk={closureGate.ok} />}
          {isFinance && <FinanceClosurePanel consultancyId={id} closure={pendingClosure} financial={financialSummary} />}
          <ClosureGateChecklist items={closureGate.items} />
          {!closureGate.items.find((i) => i.key === "financial")?.ok && canAuthoriseException && (
            <ClosureExceptionForm consultancyId={id} closureId={pendingClosure.id} />
          )}
        </div>
      )}

      {/* Each record: view the page, or download it as a letterhead PDF. */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium">
        {(
          [
            ["registration", "Registration Record", true],
            ["progress", "Progress Record", ACTIVATED_STATUSES.includes(consultancy.status)],
            ["closure", "Closure Record", consultancy.status === "completed_closed" || Boolean(pendingClosure)],
          ] as const
        )
          .filter(([, , available]) => available)
          .map(([kind, label]) => (
            <span key={kind} className="inline-flex min-h-11 items-center gap-2">
              <Link href={`/consultancies/${id}/${kind}-record`} className="text-primary hover:underline">
                {label} →
              </Link>
              <a
                href={`/api/consultancies/${id}/records/${kind}`}
                download
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-foreground hover:bg-background"
                aria-label={`Download ${label} as PDF`}
              >
                <FileDown className="h-3.5 w-3.5" aria-hidden />
                PDF
              </a>
            </span>
          ))}
      </div>

      {consultancy.status === "clarification_required" && (
        <ClarificationEditor
          consultancyId={id}
          canEdit={isOwner || session.user.roles.includes("system_admin")}
          comments={latestReturnComment}
          flaggedFields={consultancy.flaggedFields ?? []}
          currentValues={consultancy as unknown as Record<string, unknown>}
          fieldDefs={FLAGGABLE_FIELDS}
          masterData={masterData}
        />
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav className="hidden shrink-0 md:sticky md:top-4 md:block md:w-48">
          <ul className="flex flex-col gap-1">
            {SECTION_NAV.filter((s) => s.id !== "audit-trail" || auditEventsForRecord).map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <CollapsibleSection id="overview" title="Overview">
            <dl>
              <ReviewRow label="Client" value={client?.organizationName} />
              <ReviewRow label="Department" value={mainDepartment?.name} />
              <ReviewRow label="Faculty Consultant" value={registrationRecord?.facultyInCharge?.name} />
              <ReviewRow label="Academic Year" value={masterLabel(masterData.academic_year ?? [], consultancy.academicYearCode)} />
              <ReviewRow
                label="Nature of Consultancy"
                value={
                  consultancy.natureOfConsultancyCode === "other"
                    ? consultancy.natureOfConsultancyOther
                    : masterLabel(masterData.nature_of_consultancy ?? [], consultancy.natureOfConsultancyCode)
                }
              />
              <ReviewRow label="Consultancy Value" value={consultancy.totalValue ? formatInr(Number(consultancy.totalValue)) : "—"} />
              <ReviewRow label="Start Date" value={consultancy.startDate} />
              <ReviewRow label="Current Completion Date" value={consultancy.currentCompletionDate} />
              {consultancy.originalCompletionDate !== consultancy.currentCompletionDate && (
                <ReviewRow label="Original Completion Date" value={consultancy.originalCompletionDate} />
              )}
              <ReviewRow label="Agreement Reference" value={agreement?.agreementNumber} />
            </dl>
          </CollapsibleSection>

          <CollapsibleSection id="registration" title="Registration Details">
            {registrationRecord && <RegistrationDetails record={registrationRecord} />}
          </CollapsibleSection>

          <CollapsibleSection id="financials" title="Payments">
            <FinancialSummaryCard
              totalValue={financialSummary.totalValue}
              totalReceived={financialSummary.totalReceived}
              amountPending={financialSummary.amountPending}
              paymentStatus={financialSummary.paymentStatus}
            />
            <dl>
              <ReviewRow label="Agreement Value" value={agreement?.agreementValue ? formatInr(Number(agreement.agreementValue)) : "—"} />
              <ReviewRow label="Currency" value={consultancy.currencyCode} />
              <ReviewRow
                label="Estimated Institutional Costs"
                value={consultancy.estimatedInstitutionalCosts ? formatInr(Number(consultancy.estimatedInstitutionalCosts)) : "—"}
              />
              <ReviewRow
                label="Other Approved Costs"
                value={consultancy.otherApprovedCosts ? formatInr(Number(consultancy.otherApprovedCosts)) : "—"}
              />
              <ReviewRow label="Tax Applicable" value={consultancy.taxApplicable ? "Yes" : "No"} />
              {consultancy.taxApplicable && <ReviewRow label="Tax Details" value={consultancy.taxDetails} />}
            </dl>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Payment Schedule</p>
              <PaymentScheduleEditor consultancyId={id} schedules={scheduleRows} canManage={canManagePayments} />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Payments</p>
              <PaymentTransactionsPanel consultancyId={id} transactions={transactionRows} canManage={canManagePayments} />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Planned vs. Actual</p>
              <PaymentComparisonView schedules={scheduleRows} transactions={transactionRows} />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Authorised Adjustments</p>
              <PaymentAdjustmentsPanel consultancyId={id} adjustments={adjustmentRows} canManage={canManagePayments} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="documents" title="Documents">
            <DocumentRepository consultancyId={id} existingCategories={existingDocumentCategories} pinnedCategories={pinnedDocumentCategories} />
          </CollapsibleSection>

          <CollapsibleSection id="progress-milestones" title="Progress & Milestones">
            {consultancy.status !== "active" ? (
              <p className="text-sm text-muted-foreground">
                Progress updates and milestones can only be recorded while this consultancy is active.
              </p>
            ) : null}
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Progress Updates</p>
              <ProgressUpdatesPanel
                consultancyId={id}
                updates={progressUpdateRows}
                canRecord={consultancy.status === "active" && canRecordProgress}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Milestones</p>
              <MilestonesPanel
                consultancyId={id}
                milestones={milestoneRows.map(({ responsiblePerson, ...m }) => ({ ...m, responsibleName: m.responsibleName ?? responsiblePerson }))}
                overdueIds={overdueIds}
                canManage={consultancy.status === "active" && canRecordProgress}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="client-feedback" title="Client Feedback">
            <ClientFeedbackPanel
              consultancyId={id}
              acceptances={clientAcceptanceRows}
              feedback={feedbackRows}
              canRecordAcceptance={canRecordAcceptance}
              canRecordFeedback={canRecordFeedback}
              acceptanceRequired={consultancy.clientAcceptanceRequired}
            />
          </CollapsibleSection>

          <CollapsibleSection id="history" title="History">
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Lifecycle History</p>
              {extensionRows.length === 0 &&
              holdRows.length === 0 &&
              cancellationRows.length === 0 &&
              terminationRows.length === 0 &&
              reopeningRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No extension, hold, cancellation, or termination events on record.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {extensionRows.map((e) => (
                    <div key={e.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Extension</span>
                        <StatusBadge status={e.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleDateString()} · {e.originalCompletionDate} → {e.proposedCompletionDate}
                      </p>
                      <p className="mt-1 text-muted-foreground">{e.reason}</p>
                    </div>
                  ))}
                  {holdRows.map((h) => (
                    <div key={h.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{h.actualResumeDate ? "Hold (resumed)" : "Hold (open)"}</span>
                        <span className="text-xs text-muted-foreground">{h.startDate}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{h.reason}</p>
                      {h.actualResumeDate && <p className="mt-1 text-xs text-muted-foreground">Resumed {h.actualResumeDate}</p>}
                    </div>
                  ))}
                  {cancellationRows.map((c) => (
                    <div key={c.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Cancellation</span>
                        <span className="text-xs text-muted-foreground">{c.date}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{c.reason}</p>
                    </div>
                  ))}
                  {reopeningRows.map((r) => (
                    <div key={r.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Reopened</span>
                        <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-IN")}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.previousStatus.replace(/_/g, " ")} → {r.newStatus.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-muted-foreground">{r.reason}</p>
                    </div>
                  ))}
                  {terminationRows.map((t) => (
                    <div key={t.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Termination</span>
                        <span className="text-xs text-muted-foreground">{t.actualTerminationDate}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{t.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Version History</p>
              {versionRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prior versions — this record has never been returned for clarification.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {versionRows.map((v) => (
                    <div key={v.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Version {v.versionNumber}</span>
                        <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{v.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Approval Decisions</p>
              {approvalRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No verification decisions recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {approvalRows.map((a) => (
                    <div key={a.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize text-foreground">{a.stage.replace(/_/g, " ")}</span>
                        <StatusBadge status={a.decision} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(a.decidedAt).toLocaleString()}</p>
                      {a.comments && <p className="mt-1 text-muted-foreground">{a.comments}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {auditEventsForRecord && (
            <CollapsibleSection id="audit-trail" title="Audit Trail">
              {seesFinancialAudit && <p className="text-xs text-muted-foreground">Showing the financial audit trail (Finance scope).</p>}
              <AuditTrailList events={auditEventsForRecord} />
            </CollapsibleSection>
          )}
        </div>
      </div>
    </div>
  );
}
