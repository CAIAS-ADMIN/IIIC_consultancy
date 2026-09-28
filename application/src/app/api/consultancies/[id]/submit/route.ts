import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { db } from "@/db";
import {
  consultancies,
  clients,
  agreements,
  consultancyTeamMembers,
  deliverables,
  consultancyDepartments,
  milestones,
  paymentSchedules,
} from "@/db/schema";
import { submitConsultancySchema } from "@/lib/validation/consultancy";
import { getConsultancyById } from "@/db/queries/consultancies";
import { canEditDraft } from "@/lib/consultancy/access";
import { resolveRequestedFacultyInCharge } from "@/lib/consultancy/faculty-in-charge";
import { allocateConsultancyId } from "@/lib/consultancy/id";
import { resolveApprovalChain, approvalChainInputFor } from "@/lib/consultancy/approval-chain";
import { assertWorkflowStage } from "@/lib/consultancy/workflow";
import { recordAuditEvent } from "@/lib/audit";
import { notifyRole, notifyUser } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Role } from "@/db/schema/enums";

const MANDATORY_AGREEMENT_DOCUMENT_CATEGORY = "Signed Agreement";

// Protects the Consultancy ID generation path (allocateConsultancyId) against
// a runaway/scripted caller. This is a low-volume institutional workflow (a
// real faculty user submitting even 10 consultancies in 5 minutes would be
// unusual), so 50/5min bounds scripted abuse of the shared per-year sequence
// with wide headroom over legitimate use — including this project's normal
// dev workflow of rerunning the integration suite repeatedly against one
// long-lived `npm run dev` process, where the limiter's in-memory window
// persists across separate `npm test` invocations.
const SUBMIT_RATE_LIMIT = 50;
const SUBMIT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  if (!checkRateLimit(`consultancy-submit:${user.id}`, SUBMIT_RATE_LIMIT, SUBMIT_RATE_LIMIT_WINDOW_MS)) {
    return Response.json(
      { error: "Too many submission attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const { id } = await params;
  const existing = await getConsultancyById(id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "draft") {
    return Response.json({ error: `Cannot submit a consultancy in status '${existing.status}'` }, { status: 409 });
  }
  if (!canEditDraft(user, existing)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = submitConsultancySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const facultyInCharge = await resolveRequestedFacultyInCharge(user, body?.consultancy?.facultyInChargeId);
  if (facultyInCharge.error) {
    return Response.json({ error: facultyInCharge.error }, { status: 400 });
  }

  // Agreement Date cannot be later than submission date if already executed.
  const today = new Date().toISOString().slice(0, 10);
  if (input.agreement.agreementDate && input.agreement.agreementDate > today) {
    return Response.json(
      { error: { agreement: { agreementDate: ["Agreement Date cannot be later than the submission date"] } } },
      { status: 400 }
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Mandatory signed agreement document gate.
      const signedAgreement = await tx.query.documents.findFirst({
        where: (doc, { and, eq: eqOp }) =>
          and(
            eqOp(doc.consultancyId, id),
            eqOp(doc.documentCategory, MANDATORY_AGREEMENT_DOCUMENT_CATEGORY),
            eqOp(doc.status, "available")
          ),
      });
      if (!signedAgreement) {
        throw new SubmitValidationError(
          `A signed agreement document (category "${MANDATORY_AGREEMENT_DOCUMENT_CATEGORY}") must be uploaded before submission`
        );
      }

      // `expectedCompletionDate` isn't a consultancies column by that name — it seeds
      // both the immutable baseline and the "current" target that Phase 8 extensions revise.
      const { expectedCompletionDate, ...consultancyFields } = input.consultancy;

      await tx
        .update(consultancies)
        .set({
          ...consultancyFields,
          ...(facultyInCharge.userId ? { facultyInChargeId: facultyInCharge.userId } : {}),
          originalCompletionDate: expectedCompletionDate,
          currentCompletionDate: expectedCompletionDate,
          externalExpertInvolved: input.team.externalExpertInvolved,
          externalExpertDetails: input.team.externalExpertDetails,
          externalExperts: input.team.externalExpertInvolved ? input.team.externalExperts : [],
          rolesAndResponsibilities: input.team.rolesAndResponsibilities,
          totalValue: input.financial.totalValue,
          currencyCode: input.financial.currencyCode,
          currencyOther: input.financial.currencyCode === "other" ? input.financial.currencyOther : null,
          taxApplicable: input.financial.taxApplicable,
          taxRatePercent: input.financial.taxApplicable ? input.financial.taxRatePercent || null : null,
          taxAmount: input.financial.taxApplicable ? input.financial.taxAmount || null : null,
          taxDetails: input.financial.taxDetails,
          estimatedInstitutionalCosts: input.financial.estimatedInstitutionalCosts,
          otherApprovedCosts: input.financial.otherApprovedCosts,
          scopeOfWork: input.scope.scopeOfWork,
          expectedOutcomes: input.scope.expectedOutcomes,
          clientAcceptanceRequired: input.scope.clientAcceptanceRequired,
          // Screen 12 answers imply the NDA / IP-agreement document requirements
          // (they can still be set directly for older callers).
          ndaRequired:
            input.resources.ndaRequired ||
            (input.resources.confidentialInformation && input.resources.ndaAvailable === true),
          ipAgreementRequired: input.resources.ipAgreementRequired || input.resources.ipExpected === "yes",
          ipExpected: input.resources.ipExpected,
          ipTypeCodes: input.resources.ipExpected === "yes" ? input.resources.ipTypeCodes : [],
          ipTypeOther: input.resources.ipExpected === "yes" && input.resources.ipTypeCodes.includes("other") ? input.resources.ipTypeOther : null,
          ipOwnership: input.resources.ipOwnership,
          ipCommercialisationRights: input.resources.ipCommercialisationRights,
          ipRegistrationResponsibility: input.resources.ipRegistrationResponsibility,
          ipClauseReference: input.resources.ipClauseReference,
          confidentialInformation: input.resources.confidentialInformation,
          ndaAvailable: input.resources.confidentialInformation ? (input.resources.ndaAvailable ?? null) : null,
          confidentialityJustification: input.resources.confidentialityJustification,
          resourceTypeCodes: input.resources.caiasResourcesRequired ? input.resources.resourceTypeCodes : [],
          resourceTypeOther:
            input.resources.caiasResourcesRequired && input.resources.resourceTypeCodes.includes("other") ? input.resources.resourceTypeOther : null,
          resourceItems: input.resources.caiasResourcesRequired ? input.resources.resourceItems : [],
          declarationAcceptedAt: new Date(),
          declarationAcceptedBy: user.id,
          caiasResourcesRequired: input.resources.caiasResourcesRequired,
          laboratoryRequired: input.resources.laboratoryRequired,
          equipmentRequired: input.resources.equipmentRequired,
          softwareRequired: input.resources.softwareRequired,
          travelRequired: input.resources.travelRequired,
          externalExpertRequired: input.resources.externalExpertRequired,
          resourceDetails: input.resources.resourceDetails,
          estimatedResourceCost: input.resources.estimatedResourceCost,
          updatedAt: new Date(),
        })
        .where(eq(consultancies.id, id));

      const existingClient = await tx.query.clients.findFirst({ where: eq(clients.consultancyId, id) });
      if (existingClient) {
        await tx.update(clients).set(input.client).where(eq(clients.id, existingClient.id));
      } else {
        await tx.insert(clients).values({ ...input.client, consultancyId: id });
      }

      const existingAgreement = await tx.query.agreements.findFirst({ where: eq(agreements.consultancyId, id) });
      if (existingAgreement) {
        await tx.update(agreements).set(input.agreement).where(eq(agreements.id, existingAgreement.id));
      } else {
        await tx.insert(agreements).values({ ...input.agreement, consultancyId: id });
      }

      await tx.delete(consultancyTeamMembers).where(eq(consultancyTeamMembers.consultancyId, id));
      await tx.insert(consultancyTeamMembers).values(
        input.team.members.map((m) => ({ ...m, consultancyId: id }))
      );

      await tx.delete(consultancyDepartments).where(eq(consultancyDepartments.consultancyId, id));
      if (input.team.departmentsInvolved.length > 0) {
        await tx.insert(consultancyDepartments).values(
          input.team.departmentsInvolved.map((departmentId) => ({ consultancyId: id, departmentId }))
        );
      }

      await tx.delete(deliverables).where(eq(deliverables.consultancyId, id));
      await tx.insert(deliverables).values(
        input.scope.deliverables.map((d) => ({ ...d, consultancyId: id }))
      );

      // Screen 9 milestones and Screen 10 payment schedule are planned at
      // registration; execution-phase updates happen on the record later.
      await tx.delete(milestones).where(eq(milestones.consultancyId, id));
      if (input.timeline.milestones.length > 0) {
        await tx.insert(milestones).values(input.timeline.milestones.map((m) => ({ ...m, consultancyId: id })));
      }
      await tx.delete(paymentSchedules).where(eq(paymentSchedules.consultancyId, id));
      await tx.insert(paymentSchedules).values(
        input.financial.paymentSchedule.map((p) => ({ ...p, consultancyId: id }))
      );

      // A registration an admin sent back for re-edit keeps its Consultancy ID —
      // unless its academic year was changed, since the ID embeds the year.
      const consultancyCode =
        existing.consultancyCode && existing.academicYearCode === input.consultancy.academicYearCode
          ? existing.consultancyCode
          : await allocateConsultancyId(tx, input.consultancy.academicYearCode);

      // Which verification/approval stages apply is read from approval_stage_configs at
      // runtime (Phase 6) — a consultancy with no configured stages for its
      // department/area/value has nothing to gate on and goes straight to registered.
      // Resolved from the row as just saved above, so verify/activation later
      // evaluate exactly the same conditions (category, resources, IP/confidentiality).
      const savedForChain = await tx.query.consultancies.findFirst({ where: eq(consultancies.id, id) });
      const chain = await resolveApprovalChain(tx, approvalChainInputFor(savedForChain!));
      const firstStage = chain[0];

      const [submitted] = await tx
        .update(consultancies)
        .set({
          consultancyCode,
          status: firstStage ? "submitted" : "registered",
          workflowStage: firstStage ? assertWorkflowStage(firstStage.stage) : "verification_complete",
          isLocked: true,
          submittedAt: new Date(),
          registeredAt: firstStage ? null : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(consultancies.id, id))
        .returning();

      await recordAuditEvent(
        {
          consultancyId: id,
          entityType: "consultancy",
          entityId: id,
          action: "submitted",
          actorId: user.id,
          oldValue: { status: existing.status },
          newValue: { status: submitted.status, consultancyCode: submitted.consultancyCode },
        },
        tx
      );

      if (firstStage) {
        await notifyRole(
          {
            role: firstStage.approverRole as Role,
            departmentId: submitted.departmentId,
            consultancyId: id,
            type: "verification_pending",
            message: `Consultancy ${submitted.consultancyCode} ("${submitted.title}") is awaiting your verification.`,
          },
          tx
        );
        await notifyUser(
          {
            userId: submitted.facultyInChargeId,
            consultancyId: id,
            type: "submitted",
            message: `Registration ${submitted.consultancyCode} ("${submitted.title}") was submitted and is awaiting verification.`,
          },
          tx
        );
        if (firstStage.approverRole !== "iiic_admin") {
          await notifyRole(
            {
              role: "iiic_admin",
              consultancyId: id,
              type: "new_submission",
              message: `New consultancy registration ${submitted.consultancyCode} ("${submitted.title}") was submitted.`,
            },
            tx
          );
        }
      } else {
        await notifyRole(
          {
            role: "finance",
            consultancyId: id,
            type: "new_registered",
            message: `New consultancy registered: ${submitted.consultancyCode} ("${submitted.title}").`,
          },
          tx
        );
        await notifyUser(
          {
            userId: submitted.facultyInChargeId,
            consultancyId: id,
            type: "registered",
            message: `Consultancy ${submitted.consultancyCode} ("${submitted.title}") has been registered.`,
          },
          tx
        );
      }

      return submitted;
    });

    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof SubmitValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

class SubmitValidationError extends Error {}
