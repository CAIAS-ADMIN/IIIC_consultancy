import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import * as schema from "./schema";

/**
 * Inserts exactly one row per table (Phase 1 acceptance criterion), using
 * fixed ids + upsert throughout so the script is safe to re-run.
 *
 * Deleting and re-inserting isn't an option here: once a consultancy has an
 * audit_events row (which it always will, by design), the FK from
 * audit_events back to consultancies (ON DELETE RESTRICT) plus
 * audit_events' own append-only trigger mean that row can never be deleted
 * again. Upserting in place is the only way to make this idempotent.
 */
const ID = {
  department: "00000000-0000-0000-0000-000000000001",
  faculty: "00000000-0000-0000-0000-000000000002",
  approvalStageConfig: "00000000-0000-0000-0000-000000000003",
  consultancy: "00000000-0000-0000-0000-000000000004",
  client: "00000000-0000-0000-0000-000000000005",
  agreement: "00000000-0000-0000-0000-000000000006",
  teamMember: "00000000-0000-0000-0000-000000000007",
  deliverable: "00000000-0000-0000-0000-000000000008",
  document: "00000000-0000-0000-0000-000000000009",
  milestone: "00000000-0000-0000-0000-00000000000a",
  progressUpdate: "00000000-0000-0000-0000-00000000000b",
  paymentSchedule: "00000000-0000-0000-0000-00000000000c",
  paymentTransaction: "00000000-0000-0000-0000-00000000000d",
  paymentAdjustment: "00000000-0000-0000-0000-00000000000e",
  clientAcceptance: "00000000-0000-0000-0000-00000000000f",
  feedback: "00000000-0000-0000-0000-000000000010",
  closure: "00000000-0000-0000-0000-000000000011",
  closureException: "00000000-0000-0000-0000-000000000012",
  approval: "00000000-0000-0000-0000-000000000013",
  extension: "00000000-0000-0000-0000-000000000014",
  hold: "00000000-0000-0000-0000-000000000015",
  cancellation: "00000000-0000-0000-0000-000000000016",
  termination: "00000000-0000-0000-0000-000000000017",
  notification: "00000000-0000-0000-0000-000000000018",
  version: "00000000-0000-0000-0000-000000000019",
} as const;

async function seed() {
  console.log("Upserting one row per table...");

  // isActive: false — this is smoke-test furniture (Phase 1's "one row per
  // table" chain, id fixed at 00000000-0000-0000-0000-000000000001), not a
  // real selectable department. Discovered live while building the Phase 3
  // wizard: its all-zeros id fails `z.string().uuid()`'s RFC4122 version-nibble
  // check, so any real registration that picked it from a department dropdown
  // would fail submission with a cryptic "Invalid UUID" error. Deactivating
  // (not deleting — audit_events' ON DELETE RESTRICT makes this row
  // permanent anyway) keeps it out of every real `isActive: true` department
  // picker while leaving the seeded FK chain under it intact.
  const [department] = await db
    .insert(schema.departments)
    .values({ id: ID.department, name: "Computer Science & Engineering", code: "CSE", isActive: false })
    .onConflictDoUpdate({ target: schema.departments.id, set: { name: "Computer Science & Engineering", isActive: false } })
    .returning();

  const [faculty] = await db
    .insert(schema.users)
    .values({
      id: ID.faculty,
      keycloakSub: "seed-faculty-sub",
      name: "Dr. Faculty Seed",
      email: "seed-faculty-placeholder@caias.in",
      departmentId: department.id,
      roles: ["faculty"],
    })
    .onConflictDoUpdate({ target: schema.users.id, set: { departmentId: department.id, roles: ["faculty"] } })
    .returning();

  const [masterDataRow] = await db
    .insert(schema.masterData)
    .values({
      category: "consultancy_area",
      code: "AI_ML",
      label: "Artificial Intelligence & Machine Learning",
      createdBy: faculty.id,
      updatedBy: faculty.id,
    })
    .onConflictDoUpdate({
      target: [schema.masterData.category, schema.masterData.code],
      set: { label: "Artificial Intelligence & Machine Learning", updatedBy: faculty.id },
    })
    .returning();

  const [approvalStageConfig] = await db
    .insert(schema.approvalStageConfigs)
    .values({
      id: ID.approvalStageConfig,
      departmentId: department.id,
      stage: "hod_verification_pending",
      sequence: 1,
      approverRole: "hod",
    })
    .onConflictDoUpdate({
      target: schema.approvalStageConfigs.id,
      set: { departmentId: department.id },
    })
    .returning();

  const [consultancy] = await db
    .insert(schema.consultancies)
    .values({
      id: ID.consultancy,
      departmentId: department.id,
      facultyInChargeId: faculty.id,
      academicYearCode: "2025-26",
      consultancyTypeCode: "individual_faculty",
      teamTypeCode: "single_faculty",
      title: "Seed Consultancy Project",
      consultancyAreaCode: masterDataRow.code,
      createdBy: faculty.id,
    })
    .onConflictDoUpdate({
      target: schema.consultancies.id,
      set: { departmentId: department.id, facultyInChargeId: faculty.id },
    })
    .returning();

  // Never move the counter backwards: this dev DB keeps real consultancy rows
  // across re-seeds, so resetting to 1 would make the next submit collide with
  // an existing Consultancy ID (unique violation -> 500 on every submit).
  const [{ maxInUse }] = await db
    .select({
      maxInUse: sql<number>`coalesce(max(cast(substring(${schema.consultancies.consultancyCode} from '(\\d+)$') as integer)), 0)`,
    })
    .from(schema.consultancies)
    .where(eq(schema.consultancies.academicYearCode, "2025-26"));
  const floor = Math.max(1, Number(maxInUse));
  const [idSequence] = await db
    .insert(schema.consultancyIdSequences)
    .values({ academicYearCode: "2025-26", lastSequence: floor })
    .onConflictDoUpdate({
      target: schema.consultancyIdSequences.academicYearCode,
      set: { lastSequence: sql`greatest(${schema.consultancyIdSequences.lastSequence}, ${floor})` },
    })
    .returning();

  const [client] = await db
    .insert(schema.clients)
    .values({
      id: ID.client,
      consultancyId: consultancy.id,
      organizationName: "Seed Client Pvt Ltd",
      organizationTypeCode: "private_company",
    })
    .onConflictDoUpdate({ target: schema.clients.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [agreement] = await db
    .insert(schema.agreements)
    .values({
      id: ID.agreement,
      consultancyId: consultancy.id,
      agreementTypeCode: "work_order",
      agreementValue: "100000.00",
      paymentTermsCode: "milestone_based",
    })
    .onConflictDoUpdate({ target: schema.agreements.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [teamMember] = await db
    .insert(schema.consultancyTeamMembers)
    .values({
      id: ID.teamMember,
      consultancyId: consultancy.id,
      userId: faculty.id,
      name: faculty.name,
      role: "Principal Investigator",
    })
    .onConflictDoUpdate({ target: schema.consultancyTeamMembers.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [deliverable] = await db
    .insert(schema.deliverables)
    .values({
      id: ID.deliverable,
      consultancyId: consultancy.id,
      description: "Seed deliverable: final report",
    })
    .onConflictDoUpdate({ target: schema.deliverables.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [document] = await db
    .insert(schema.documents)
    .values({
      id: ID.document,
      consultancyId: consultancy.id,
      documentCategory: "Signed Agreement",
      originalFileName: "agreement.pdf",
      objectKey: `consultancies/${consultancy.id}/signed-agreement/v1.pdf`,
      uploadedBy: faculty.id,
      status: "available",
    })
    .onConflictDoUpdate({ target: schema.documents.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [milestone] = await db
    .insert(schema.milestones)
    .values({
      id: ID.milestone,
      consultancyId: consultancy.id,
      deliverableId: deliverable.id,
      title: "Seed milestone",
      plannedDate: "2026-01-01",
      responsibleConsultantId: faculty.id,
      evidenceDocumentId: document.id,
    })
    .onConflictDoUpdate({ target: schema.milestones.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [progressUpdate] = await db
    .insert(schema.progressUpdates)
    .values({
      id: ID.progressUpdate,
      consultancyId: consultancy.id,
      reportDate: "2025-12-01",
      reportingPeriodStart: "2025-11-01",
      reportingPeriodEnd: "2025-11-30",
      status: "on_track",
      overallProgressPercent: 25,
      createdBy: faculty.id,
    })
    .onConflictDoUpdate({ target: schema.progressUpdates.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [paymentSchedule] = await db
    .insert(schema.paymentSchedules)
    .values({
      id: ID.paymentSchedule,
      consultancyId: consultancy.id,
      stageLabel: "Advance",
      plannedAmount: "30000.00",
    })
    .onConflictDoUpdate({ target: schema.paymentSchedules.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [paymentTransaction] = await db
    .insert(schema.paymentTransactions)
    .values({
      id: ID.paymentTransaction,
      consultancyId: consultancy.id,
      amount: "30000.00",
      transactionDate: "2025-12-05",
      institutionalAccountRef: "IIIC-ACC-001",
      transactionRef: "TXN-SEED-001",
      recordedBy: faculty.id,
    })
    .onConflictDoUpdate({ target: schema.paymentTransactions.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [paymentAdjustment] = await db
    .insert(schema.paymentAdjustments)
    .values({
      id: ID.paymentAdjustment,
      consultancyId: consultancy.id,
      amount: "0.00",
      reason: "Seed adjustment placeholder",
      authorisedBy: faculty.id,
    })
    .onConflictDoUpdate({ target: schema.paymentAdjustments.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [clientAcceptance] = await db
    .insert(schema.clientAcceptances)
    .values({
      id: ID.clientAcceptance,
      consultancyId: consultancy.id,
      acceptedByName: "Seed Client Contact",
      acceptanceDate: "2025-12-10",
      documentId: document.id,
    })
    .onConflictDoUpdate({ target: schema.clientAcceptances.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [feedback] = await db
    .insert(schema.clientFeedback)
    .values({
      id: ID.feedback,
      consultancyId: consultancy.id,
      feedbackDate: "2025-12-10",
      rating: 5,
      comments: "Seed feedback",
    })
    .onConflictDoUpdate({ target: schema.clientFeedback.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [closure] = await db
    .insert(schema.closures)
    .values({
      id: ID.closure,
      consultancyId: consultancy.id,
      requestedBy: faculty.id,
      actualCompletionDate: "2025-12-15",
      deliverableCompletionStatus: "yes",
      finalOutcomes: "Seed outcomes",
      finalReportDocumentId: document.id,
    })
    .onConflictDoUpdate({ target: schema.closures.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [closureException] = await db
    .insert(schema.closureExceptions)
    .values({
      id: ID.closureException,
      closureId: closure.id,
      reason: "Seed exception",
      amountOutstanding: "0.00",
      expectedRecoveryAction: "N/A",
      authorisingOfficerId: faculty.id,
      date: "2025-12-15",
    })
    .onConflictDoUpdate({ target: schema.closureExceptions.id, set: { closureId: closure.id } })
    .returning();

  const [approval] = await db
    .insert(schema.approvals)
    .values({
      id: ID.approval,
      consultancyId: consultancy.id,
      stage: "hod_verification_pending",
      decision: "verify",
      decidedBy: faculty.id,
    })
    .onConflictDoUpdate({ target: schema.approvals.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [extension] = await db
    .insert(schema.extensions)
    .values({
      id: ID.extension,
      consultancyId: consultancy.id,
      originalCompletionDate: "2025-12-31",
      proposedCompletionDate: "2026-03-31",
      reason: "Seed extension reason",
      requestedBy: faculty.id,
    })
    .onConflictDoUpdate({ target: schema.extensions.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [hold] = await db
    .insert(schema.holds)
    .values({
      id: ID.hold,
      consultancyId: consultancy.id,
      reason: "Seed hold reason",
      startDate: "2025-12-20",
      authorisedBy: faculty.id,
    })
    .onConflictDoUpdate({ target: schema.holds.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [cancellation] = await db
    .insert(schema.cancellations)
    .values({
      id: ID.cancellation,
      consultancyId: consultancy.id,
      reason: "Seed cancellation reason",
      date: "2025-12-21",
      initiatedBy: faculty.id,
      financialStatus: "No dues",
    })
    .onConflictDoUpdate({ target: schema.cancellations.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [termination] = await db
    .insert(schema.terminations)
    .values({
      id: ID.termination,
      consultancyId: consultancy.id,
      reason: "Seed termination reason",
      actualTerminationDate: "2025-12-22",
      financialStatus: "No dues",
      initiatedBy: faculty.id,
    })
    .onConflictDoUpdate({ target: schema.terminations.id, set: { consultancyId: consultancy.id } })
    .returning();

  // audit_events is append-only — no upsert, just insert once per run's
  // consultancy (harmless to accumulate; the row is never touched again).
  const [auditEvent] = await db
    .insert(schema.auditEvents)
    .values({
      consultancyId: consultancy.id,
      entityType: "consultancy",
      entityId: consultancy.id,
      action: "seed_created",
      actorId: faculty.id,
    })
    .returning();

  const [notification] = await db
    .insert(schema.notifications)
    .values({
      id: ID.notification,
      userId: faculty.id,
      consultancyId: consultancy.id,
      type: "seed_notification",
      message: "Seed notification",
    })
    .onConflictDoUpdate({ target: schema.notifications.id, set: { consultancyId: consultancy.id } })
    .returning();

  const [version] = await db
    .insert(schema.consultancyVersions)
    .values({
      id: ID.version,
      consultancyId: consultancy.id,
      versionNumber: 1,
      snapshot: { title: consultancy.title },
      reason: "seed",
      createdBy: faculty.id,
    })
    .onConflictDoUpdate({ target: schema.consultancyVersions.id, set: { consultancyId: consultancy.id } })
    .returning();

  console.log("Seed complete:", {
    department: department.id,
    faculty: faculty.id,
    masterDataRow: masterDataRow.id,
    approvalStageConfig: approvalStageConfig.id,
    consultancy: consultancy.id,
    idSequence: idSequence.academicYearCode,
    client: client.id,
    agreement: agreement.id,
    teamMember: teamMember.id,
    deliverable: deliverable.id,
    document: document.id,
    milestone: milestone.id,
    progressUpdate: progressUpdate.id,
    paymentSchedule: paymentSchedule.id,
    paymentTransaction: paymentTransaction.id,
    paymentAdjustment: paymentAdjustment.id,
    clientAcceptance: clientAcceptance.id,
    feedback: feedback.id,
    closure: closure.id,
    closureException: closureException.id,
    approval: approval.id,
    extension: extension.id,
    hold: hold.id,
    cancellation: cancellation.id,
    termination: termination.id,
    auditEvent: auditEvent.id,
    notification: notification.id,
    version: version.id,
  });
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
