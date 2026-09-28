import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clientAcceptances,
  clientFeedback,
  closureExceptions,
  closures,
  documents,
  extensions,
  holds,
  milestones,
  paymentSchedules,
  paymentTransactions,
  progressUpdates,
  users,
} from "@/db/schema";
import { getRegistrationRecord } from "@/db/queries/registration-record";
import { getConsultancyDerivedFields } from "@/db/queries/consultancy-derived";
import { listDocumentsForConsultancy } from "@/db/queries/documents";
import { getFinancialSummary } from "@/lib/consultancy/financials";
import { CLOSURE_DECLARATION_ITEMS, FINAL_OUTCOME_OPTIONS, RATING_LABELS } from "@/lib/validation/closure";
import { humanizeStatus } from "@/lib/status";
import { formatInr } from "@/lib/format";
import { RECORD_HEADINGS, type RecordDocument, type RecordKind, type RecordSection } from "./model";
import { registrationSections } from "./registration";

type Consultancy = NonNullable<Awaited<ReturnType<typeof getRegistrationRecord>>>["consultancy"];

const humanize = (value: string) => value.replace(/_/g, " ");
const COMPLETED_LABEL: Record<string, string> = { yes: "Completed", partially: "Partially completed", no: "Not completed" };

function docRef(doc: { id: string; version: number } | undefined | null): string {
  return doc ? `Available in CAIAS Consultancy Portal — ref. ${doc.id.slice(0, 8).toUpperCase()} (v${doc.version})` : "—";
}

/**
 * Builds a Registration / Progress / Closure record for one consultancy, or
 * null when it doesn't exist or is still a draft. The caller checks access
 * (`canViewConsultancy`) with the returned consultancy.
 */
export async function loadRecordDocument(kind: RecordKind, id: string): Promise<{ document: RecordDocument; consultancy: Consultancy } | null> {
  const record = await getRegistrationRecord(id);
  if (!record || record.consultancy.status === "draft") return null;
  const c = record.consultancy;

  const base = {
    kind,
    heading: RECORD_HEADINGS[kind],
    consultancyCode: c.consultancyCode,
    title: c.title,
    generatedAt: new Date(),
  };

  if (kind === "registration") {
    return { consultancy: c, document: { ...base, statuses: [c.status], sections: registrationSections(record) } };
  }
  if (kind === "progress") {
    return { consultancy: c, document: { ...base, statuses: [c.status], sections: await progressSections(c) } };
  }
  const closure = await closureSections(record);
  return { consultancy: c, document: { ...base, statuses: [c.status, ...(closure.closureStatus ? [closure.closureStatus] : [])], sections: closure.sections } };
}

/** PDF 2 — Consultancy Progress Record (portal spec §38). */
async function progressSections(c: Consultancy): Promise<RecordSection[]> {
  const id = c.id;
  const [derived, financial, milestoneRows, progressRows, scheduleRows, transactionRows, extensionRows, holdRows, documentRows] = await Promise.all([
    getConsultancyDerivedFields(c),
    getFinancialSummary(c),
    db.select().from(milestones).where(eq(milestones.consultancyId, id)).orderBy(asc(milestones.plannedDate)),
    db.select().from(progressUpdates).where(eq(progressUpdates.consultancyId, id)).orderBy(desc(progressUpdates.reportDate)),
    db.select().from(paymentSchedules).where(eq(paymentSchedules.consultancyId, id)).orderBy(asc(paymentSchedules.plannedDate)),
    db.select().from(paymentTransactions).where(eq(paymentTransactions.consultancyId, id)).orderBy(asc(paymentTransactions.transactionDate)),
    db.select().from(extensions).where(eq(extensions.consultancyId, id)).orderBy(desc(extensions.createdAt)),
    db.select().from(holds).where(eq(holds.consultancyId, id)).orderBy(desc(holds.createdAt)),
    listDocumentsForConsultancy(id),
  ]);
  const overdue = new Set(derived.overdueMilestones.map((m) => m.id));
  const latest = progressRows[0];

  return [
    {
      title: "Current Status",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Start Date", c.startDate],
            ["Current Completion Date", c.currentCompletionDate],
            ["Original Completion Date", c.originalCompletionDate !== c.currentCompletionDate ? c.originalCompletionDate : ""],
            ["Days Elapsed", derived.daysElapsed?.toString()],
            ["Days Remaining", derived.daysRemaining?.toString()],
            ["Completion Overdue", derived.isCompletionOverdue ? "Yes" : "No"],
            ["Latest Progress", latest ? `${latest.overallProgressPercent}% (reported ${latest.reportDate})` : "No progress reported yet"],
          ],
        },
        { kind: "note", text: "Progress percentage is a monitoring measure, not a financial or contractual completion measure." },
      ],
    },
    {
      title: "Milestones",
      blocks: [
        {
          kind: "table",
          head: ["Milestone", "Planned", "Actual Start", "Actual Completion", "Status"],
          rows: milestoneRows.map((m) => [
            m.title,
            m.plannedDate,
            m.actualStartDate,
            m.actualDate,
            overdue.has(m.id) ? `${humanize(m.status)} — overdue` : humanize(m.status),
          ]),
        },
      ],
    },
    {
      title: "Progress Updates",
      blocks:
        progressRows.length === 0
          ? [{ kind: "note", text: "None recorded." }]
          : progressRows.map((p) => ({
              kind: "card" as const,
              title: `${p.reportDate} · ${p.reportingPeriodStart} – ${p.reportingPeriodEnd} · ${p.overallProgressPercent}% · ${humanize(p.status)}`,
              blocks: [
                {
                  kind: "fields" as const,
                  rows: [
                    ["Work Completed", p.workCompleted],
                    ["Work in Progress", p.workInProgress],
                    ["Pending Activities", p.pendingActivities],
                    ["Challenges / Issues", p.challenges],
                    ["Corrective Action", p.correctiveAction],
                    ["Next Planned Activity", p.nextPlannedActivity],
                  ] as [string, string | null][],
                },
              ],
            })),
    },
    {
      title: "Payments",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Total Consultancy Value", formatInr(financial.totalValue)],
            ["Amount Received", formatInr(financial.totalReceived)],
            ["Amount Pending", formatInr(financial.amountPending)],
            ["Payment Status", humanizeStatus(financial.paymentStatus)],
          ],
        },
        { kind: "table", head: ["Scheduled Stage", "Amount", "Due"], rows: scheduleRows.map((s) => [s.stageLabel, formatInr(Number(s.plannedAmount)), s.plannedDate]) },
        {
          kind: "table",
          head: ["Received", "Amount", "TDS", "Receipt / Transaction Ref."],
          rows: transactionRows.map((t) => [t.transactionDate, formatInr(Number(t.amount)), t.tdsDeducted ? formatInr(Number(t.tdsDeducted)) : "", t.transactionRef]),
        },
      ],
    },
    {
      title: "Key Updates",
      blocks: [
        {
          kind: "table",
          head: ["Event", "Date", "Detail"],
          rows: [
            ...extensionRows.map((e) => [
              `Extension (${e.status})`,
              new Date(e.createdAt).toLocaleDateString("en-IN"),
              `${e.originalCompletionDate} → ${e.proposedCompletionDate}: ${e.reason}`,
            ]),
            ...holdRows.map((h) => [h.actualResumeDate ? "Hold (resumed)" : "On hold", h.startDate, h.reason]),
          ],
        },
      ],
    },
    {
      title: "Documents Available in the Portal",
      blocks: [
        {
          kind: "table",
          head: ["Document", "Version", "Uploaded", "Reference"],
          rows: documentRows
            .filter((d) => d.status === "available")
            .map((d) => [d.documentCategory, `v${d.version}`, new Date(d.uploadedAt).toLocaleDateString("en-IN"), d.id.slice(0, 8).toUpperCase()]),
        },
      ],
    },
  ];
}

/** PDF 3 — the Consultancy Closure Record (portal spec §31 / §38). Uploaded documents are referenced, never embedded. */
async function closureSections(
  record: NonNullable<Awaited<ReturnType<typeof getRegistrationRecord>>>
): Promise<{ sections: RecordSection[]; closureStatus: string | null }> {
  const consultancy = record.consultancy;
  const id = consultancy.id;
  const [progress, closureRows, financial, acceptanceRows, feedbackRows] = await Promise.all([
    db.select().from(progressUpdates).where(eq(progressUpdates.consultancyId, id)).orderBy(asc(progressUpdates.reportDate)),
    db.select().from(closures).where(eq(closures.consultancyId, id)).orderBy(desc(closures.createdAt)),
    getFinancialSummary(consultancy),
    db.select().from(clientAcceptances).where(eq(clientAcceptances.consultancyId, id)).orderBy(desc(clientAcceptances.createdAt)),
    db.select().from(clientFeedback).where(eq(clientFeedback.consultancyId, id)).orderBy(desc(clientFeedback.createdAt)),
  ]);

  const finalClosure = closureRows.find((c) => c.status === "verified") ?? closureRows[0] ?? null;
  const personIds = [finalClosure?.verifiedBy, finalClosure?.financeVerifiedBy, finalClosure?.requestedBy].filter((v): v is string => Boolean(v));
  const docIds = [finalClosure?.finalReportDocumentId, ...(finalClosure?.deliverableOutcomes ?? []).map((d) => d.evidenceDocumentId)].filter(
    (v): v is string => Boolean(v)
  );
  const [exceptionRows, people, closureDocs] = await Promise.all([
    finalClosure ? db.select().from(closureExceptions).where(eq(closureExceptions.closureId, finalClosure.id)) : Promise.resolve([]),
    personIds.length > 0 ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, personIds)) : Promise.resolve([]),
    docIds.length > 0 ? db.select({ id: documents.id, version: documents.version }).from(documents).where(inArray(documents.id, docIds)) : Promise.resolve([]),
  ]);
  const nameOf = (userId: string | null | undefined) => people.find((p) => p.id === userId)?.name ?? "—";
  const docById = (docId: string | null | undefined) => closureDocs.find((d) => d.id === docId);

  const acceptance = acceptanceRows[0];
  const ratings = feedbackRows.map((f) => f.rating).filter((r): r is number => r !== null);
  const outcome = FINAL_OUTCOME_OPTIONS.find((o) => o.code === finalClosure?.finalOutcome)?.label;
  const outcomeFor = (deliverableId: string) => finalClosure?.deliverableOutcomes.find((o) => o.deliverableId === deliverableId);
  const consultants = record.team.map((m) => m.name).join(", ") || record.facultyInCharge?.name;
  const lastProgress = progress[progress.length - 1];

  const sections: RecordSection[] = [
    {
      title: "Closure Record",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Consultancy ID", consultancy.consultancyCode],
            ["Department", record.departmentName],
            ["Consultant(s)", consultants],
            ["Client", record.client?.organizationName],
            ["Consultancy Title", consultancy.title],
            ["Agreement Reference", record.agreement?.agreementNumber],
            ["Start Date", consultancy.startDate],
            ["Completion Date", finalClosure?.actualCompletionDate ?? consultancy.actualCompletionDate],
            ["Consultancy Value", formatInr(financial.totalValue)],
            ["Payment Status", humanizeStatus(financial.paymentStatus)],
            ["Outcome", outcome],
            [
              "Client Acceptance",
              acceptance
                ? `${humanize(acceptance.acceptanceStatus)}${acceptance.acceptedByName ? ` — ${acceptance.acceptedByName}, ${acceptance.acceptanceDate}` : ""}`
                : "Not recorded",
            ],
            ["Final Report", docRef(docById(finalClosure?.finalReportDocumentId))],
            ["Closure Date", finalClosure?.verifiedAt ? new Date(finalClosure.verifiedAt).toLocaleDateString("en-IN") : "Pending verification"],
          ],
        },
      ],
    },
    {
      title: "Deliverables",
      blocks: [
        {
          kind: "table",
          head: ["Deliverable", "Planned", "Status", "Completed On", "Evidence", "Remarks"],
          rows: record.deliverables.map((d) => {
            const o = outcomeFor(d.id);
            return [
              d.name ?? d.description,
              d.dueDate,
              o ? COMPLETED_LABEL[o.completed] : humanize(d.status),
              o?.completionDate,
              o?.evidenceDocumentId ? docRef(docById(o.evidenceDocumentId)) : "",
              o?.remarks,
            ];
          }),
        },
      ],
    },
    {
      title: "Final Consultancy Details",
      blocks: finalClosure
        ? [
            {
              kind: "fields",
              rows: [
                ["Closure Requested", `${new Date(finalClosure.createdAt).toLocaleDateString("en-IN")} by ${nameOf(finalClosure.requestedBy)}`],
                ["Final Progress", finalClosure.finalProgressPercent === null ? "" : `${finalClosure.finalProgressPercent}%`],
                [
                  "Deliverables Completed",
                  `${COMPLETED_LABEL[finalClosure.deliverableCompletionStatus]}${finalClosure.partialReason ? ` — ${finalClosure.partialReason}` : ""}`,
                ],
                ["Final Outcome", outcome],
                ["Outcome Reason", finalClosure.outcomeReason],
                ["Outcomes Summary", finalClosure.finalOutcomes],
                ["Client Feedback", ratings.length > 0 ? `${ratings[0]}/5 — ${RATING_LABELS[ratings[0]]}` : (feedbackRows[0]?.comments ?? "Not recorded")],
              ],
            },
          ]
        : [{ kind: "note", text: "No closure request on record yet." }],
    },
    {
      title: "Financial Closure",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Total Agreement Value", formatInr(financial.totalValue)],
            ["Total Received", formatInr(financial.totalReceived)],
            ["Balance", formatInr(financial.amountPending)],
            [
              "Consultant's Statement",
              finalClosure?.fullPaymentReceived === null || finalClosure?.fullPaymentReceived === undefined
                ? ""
                : finalClosure.fullPaymentReceived
                  ? "Full amount received"
                  : `Pending ${formatInr(Number(finalClosure.amountPending ?? 0))} — ${finalClosure.pendingReason ?? ""} (expected ${finalClosure.expectedPaymentDate ?? "—"})`,
            ],
            [
              "Finance Verification",
              finalClosure?.financeVerificationStatus
                ? `${finalClosure.financeVerificationStatus === "verified" ? "Verified" : "Discrepancy flagged"} by ${nameOf(finalClosure.financeVerifiedBy)} on ${
                    finalClosure.financeVerifiedAt ? new Date(finalClosure.financeVerifiedAt).toLocaleDateString("en-IN") : "—"
                  }`
                : "Not verified",
            ],
            ["Finance Remarks", finalClosure?.financeRemarks],
            [
              "Authorised Exception",
              exceptionRows[0]
                ? `${formatInr(Number(exceptionRows[0].amountOutstanding))} outstanding — ${exceptionRows[0].reason}; action: ${exceptionRows[0].expectedRecoveryAction}`
                : "None",
            ],
          ],
        },
      ],
    },
    {
      title: "Monitoring Summary",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Progress Updates", `${progress.length}${lastProgress ? ` — last ${lastProgress.reportDate} at ${lastProgress.overallProgressPercent}%` : ""}`],
            ["Milestones", `${record.milestones.filter((m) => m.status === "completed").length} of ${record.milestones.length} completed`],
          ],
        },
      ],
    },
    {
      title: "Closure Declaration",
      blocks: finalClosure?.declarationAcceptedAt
        ? [
            { kind: "list", items: CLOSURE_DECLARATION_ITEMS.map((item) => item.text) },
            {
              kind: "fields",
              rows: [
                ["Declared by", nameOf(finalClosure.requestedBy)],
                ["Date", new Date(finalClosure.declarationAcceptedAt).toLocaleString("en-IN")],
                ["Verified by (CAIAS)", finalClosure.verifiedBy ? nameOf(finalClosure.verifiedBy) : "Pending"],
              ],
            },
          ]
        : [{ kind: "note", text: "No closure declaration on record." }],
    },
  ];

  return { sections, closureStatus: finalClosure?.status ?? null };
}
