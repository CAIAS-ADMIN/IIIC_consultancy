import { notFound, redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  departments,
  consultancyTeamMembers,
  deliverables,
  consultancyDepartments,
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
} from "@/db/schema";
import { getConsultancyById, getClientByConsultancyId, getAgreementByConsultancyId } from "@/db/queries/consultancies";
import { listMasterData } from "@/db/queries/master-data";
import { listDocumentsForConsultancy } from "@/db/queries/documents";
import { getConsultancyDerivedFields } from "@/db/queries/consultancy-derived";
import { resolveApprovalChain } from "@/lib/consultancy/approval-chain";
import { checkActivationGates } from "@/lib/consultancy/activation";
import { checkClosureGates } from "@/lib/consultancy/closure-gates";
import { isConsultancyMember } from "@/lib/consultancy/access";
import { getFinancialSummary } from "@/lib/consultancy/financials";
import { FLAGGABLE_FIELDS } from "@/lib/consultancy/flaggable-fields";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { DocumentCategoryPanel } from "@/components/documents/document-category-panel";
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
import { ClientAcceptanceForm } from "@/components/closure/client-acceptance-form";
import { RequestClosureDialog } from "@/components/closure/request-closure-dialog";
import { ClosureVerifyActions } from "@/components/closure/closure-verify-actions";
import Link from "next/link";
import { formatInr } from "@/lib/format";
import type { Role } from "@/db/schema/enums";

const VERIFIABLE_STATUSES = ["submitted", "under_verification"];
const FIXED_DOCUMENT_CATEGORIES = ["Signed Agreement", "NDA", "IP Agreement"];
const ACTIVATED_STATUSES = ["active", "on_hold", "extension_requested", "delayed", "closure_requested", "completed_closed"];
/** Matches `cancel`/`terminate` routes' own `TERMINAL_STATUSES` exactly. */
const CANCEL_TERMINATE_BLOCKED_STATUSES = ["cancelled", "terminated", "completed_closed", "rejected", "draft"];

const SECTION_NAV = [
  { id: "overview", label: "Overview" },
  { id: "team-agreement", label: "Team & Agreement" },
  { id: "financials", label: "Financials" },
  { id: "documents", label: "Documents" },
  { id: "progress-milestones", label: "Progress & Milestones" },
  { id: "history", label: "History" },
];

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
  const isElevated = session.user.roles.some((r) => ["hod", "iiic_admin", "system_admin"].includes(r));

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

  const [
    client,
    agreement,
    teamMembers,
    deliverableRows,
    departmentsInvolvedRows,
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
    db.query.consultancyTeamMembers.findMany({ where: eq(consultancyTeamMembers.consultancyId, id) }),
    db.query.deliverables.findMany({ where: eq(deliverables.consultancyId, id) }),
    db.query.consultancyDepartments.findMany({ where: eq(consultancyDepartments.consultancyId, id) }),
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
        plannedDate: milestones.plannedDate,
        actualDate: milestones.actualDate,
        status: milestones.status,
        remarks: milestones.remarks,
        responsibleName: users.name,
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

  const [closureRows, clientAcceptanceRows] = await Promise.all([
    db.query.closures.findMany({ where: eq(closures.consultancyId, id), orderBy: (row, { desc }) => [desc(row.createdAt)] }),
    db.query.clientAcceptances.findMany({ where: eq(clientAcceptances.consultancyId, id) }),
  ]);
  const pendingClosure = closureRows.find((c) => c.status === "requested") ?? null;
  const closureGate = pendingClosure ? await checkClosureGates(consultancy, pendingClosure) : null;

  const masterData: Record<string, { code: string; label: string }[]> = {};
  for (const row of masterDataRows) {
    (masterData[row.category] ??= []).push({ code: row.code, label: row.label });
  }

  const extraDocumentCategories = [...new Set(documentRows.map((d) => d.documentCategory))].filter(
    (c) => !FIXED_DOCUMENT_CATEGORIES.includes(c)
  );

  let requiredRole: Role | null = null;
  if (VERIFIABLE_STATUSES.includes(consultancy.status)) {
    const chain = await resolveApprovalChain(db, {
      departmentId: consultancy.departmentId,
      consultancyAreaCode: consultancy.consultancyAreaCode,
      totalValue: consultancy.totalValue,
    });
    const currentStage = chain.find((s) => s.stage === consultancy.workflowStage);
    requiredRole = (currentStage?.approverRole as Role) ?? null;
  }
  const canAct = requiredRole !== null && (session.user.roles.includes(requiredRole) || session.user.roles.includes("system_admin"));

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
  const needsClientAcceptance =
    consultancy.clientAcceptanceRequired &&
    clientAcceptanceRows.length === 0 &&
    ["active", "closure_requested"].includes(consultancy.status) &&
    canRecordProgress;
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

      {canRequestClosure && <RequestClosureDialog consultancyId={id} />}

      {needsClientAcceptance && <ClientAcceptanceForm consultancyId={id} />}

      {pendingClosure && closureGate && (
        <div className="flex flex-col gap-3">
          {canVerifyClosure && <ClosureVerifyActions consultancyId={id} closureId={pendingClosure.id} gateOk={closureGate.ok} />}
          <ClosureGateChecklist items={closureGate.items} />
          {!closureGate.items.find((i) => i.key === "financial")?.ok && canAuthoriseException && (
            <ClosureExceptionForm consultancyId={id} closureId={pendingClosure.id} />
          )}
        </div>
      )}

      {(consultancy.status === "completed_closed" || pendingClosure) && (
        <Link href={`/consultancies/${id}/closure-record`} className="text-sm font-medium text-primary hover:underline">
          View Closure Record →
        </Link>
      )}

      {consultancy.status === "clarification_required" && (
        <ClarificationEditor
          consultancyId={id}
          canEdit={isOwner || session.user.roles.includes("system_admin")}
          comments={latestReturnComment}
          flaggedFields={consultancy.flaggedFields ?? []}
          currentValues={consultancy as unknown as Record<string, unknown>}
          fieldDefs={FLAGGABLE_FIELDS}
        />
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav className="hidden shrink-0 md:sticky md:top-4 md:block md:w-48">
          <ul className="flex flex-col gap-1">
            {SECTION_NAV.map((s) => (
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
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Client</p>
              <dl>
                <ReviewRow label="Organization" value={client?.organizationName} />
                <ReviewRow label="Type" value={masterLabel(masterData.organization_type ?? [], client?.organizationTypeCode)} />
                <ReviewRow label="Contact" value={client?.contactPersonName} />
                <ReviewRow label="Designation" value={client?.designation} />
                <ReviewRow label="Email" value={client?.contactEmail} />
                <ReviewRow label="Phone" value={client?.contactPhone} />
                <ReviewRow label="Address" value={client?.address} />
              </dl>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Consultancy Details</p>
              <dl>
                <ReviewRow label="Department" value={mainDepartment?.name} />
                <ReviewRow label="Academic Year" value={masterLabel(masterData.academic_year ?? [], consultancy.academicYearCode)} />
                <ReviewRow label="Consultancy Type" value={masterLabel(masterData.consultancy_type ?? [], consultancy.consultancyTypeCode)} />
                <ReviewRow
                  label="Consultancy Area"
                  value={
                    consultancy.consultancyAreaCode === "other"
                      ? consultancy.consultancyAreaOther
                      : masterLabel(masterData.consultancy_area ?? [], consultancy.consultancyAreaCode)
                  }
                />
                <ReviewRow label="Start Date" value={consultancy.startDate} />
                <ReviewRow label="Current Completion Date" value={consultancy.currentCompletionDate} />
                {consultancy.originalCompletionDate !== consultancy.currentCompletionDate && (
                  <ReviewRow label="Original Completion Date" value={consultancy.originalCompletionDate} />
                )}
                <ReviewRow label="NDA Required" value={consultancy.ndaRequired ? "Yes" : "No"} />
                <ReviewRow label="IP Agreement Required" value={consultancy.ipAgreementRequired ? "Yes" : "No"} />
              </dl>
              {consultancy.description && <p className="mt-3 text-sm text-muted-foreground">{consultancy.description}</p>}
              <p className="mt-3 text-sm font-medium text-foreground">Scope of Work</p>
              <p className="text-sm text-muted-foreground">{consultancy.scopeOfWork || "—"}</p>
              {deliverableRows.length > 0 && (
                <>
                  <p className="mt-3 text-sm font-medium text-foreground">Deliverables</p>
                  <ul className="list-inside list-disc text-sm text-foreground">
                    {deliverableRows.map((d) => (
                      <li key={d.id}>
                        {d.description}
                        {d.dueDate && <span className="text-muted-foreground"> — due {d.dueDate}</span>}
                        <span className="text-muted-foreground"> ({d.status.replace(/_/g, " ")})</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="team-agreement" title="Team & Agreement">
            {teamMembers.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-foreground">
                {teamMembers.map((m) => (
                  <li key={m.id}>
                    {m.name} — {m.role}
                    {m.isExternal && <span className="text-muted-foreground"> (external)</span>}
                  </li>
                ))}
              </ul>
            )}
            <dl>
              <ReviewRow label="Agreement Type" value={masterLabel(masterData.agreement_type ?? [], agreement?.agreementTypeCode)} />
              <ReviewRow label="Agreement Number" value={agreement?.agreementNumber} />
              <ReviewRow label="Agreement Date" value={agreement?.agreementDate} />
              <ReviewRow label="Payment Terms" value={masterLabel(masterData.payment_terms ?? [], agreement?.paymentTermsCode)} />
              <ReviewRow label="Payment Mode" value={masterLabel(masterData.payment_mode ?? [], agreement?.paymentModeCode)} />
              {consultancy.externalExpertInvolved && (
                <ReviewRow label="External Expert" value={consultancy.externalExpertDetails} />
              )}
              {consultancy.rolesAndResponsibilities && (
                <ReviewRow label="Roles & Responsibilities" value={consultancy.rolesAndResponsibilities} />
              )}
              {consultancy.caiasResourcesRequired && <ReviewRow label="CAIAS Resources" value={consultancy.resourceDetails} />}
            </dl>
            {departmentsInvolvedRows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {departmentsInvolvedRows.length} additional department{departmentsInvolvedRows.length === 1 ? "" : "s"} involved
              </p>
            )}
          </CollapsibleSection>

          <CollapsibleSection id="financials" title="Financials">
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
            <DocumentCategoryPanel consultancyId={id} category="Signed Agreement" label="Signed Agreement" required />
            {consultancy.ndaRequired && (
              <DocumentCategoryPanel consultancyId={id} category="NDA" label="Non-Disclosure Agreement" />
            )}
            {consultancy.ipAgreementRequired && (
              <DocumentCategoryPanel consultancyId={id} category="IP Agreement" label="IP Agreement" />
            )}
            {extraDocumentCategories.map((category) => (
              <DocumentCategoryPanel key={category} consultancyId={id} category={category} label={category} />
            ))}
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
                milestones={milestoneRows}
                overdueIds={overdueIds}
                canManage={consultancy.status === "active" && canRecordProgress}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection id="history" title="History">
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Lifecycle History</p>
              {extensionRows.length === 0 && holdRows.length === 0 && cancellationRows.length === 0 && terminationRows.length === 0 ? (
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
        </div>
      </div>
    </div>
  );
}
