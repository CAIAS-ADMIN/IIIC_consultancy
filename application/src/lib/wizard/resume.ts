import type { consultancies, clients, agreements, consultancyTeamMembers, deliverables } from "@/db/schema";
import { createInitialWizardState, type WizardState } from "./types";

type ConsultancyRow = typeof consultancies.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type AgreementRow = typeof agreements.$inferSelect;
type TeamMemberRow = typeof consultancyTeamMembers.$inferSelect;
type DeliverableRow = typeof deliverables.$inferSelect;

/** Rebuilds wizard form state from a draft's persisted rows (resume flow). Anything the backend has no draft-stage column for (e.g. `expectedCompletionDate`) comes back blank — see `buildDraftPatchBody`'s note. */
export function wizardStateFromDraft(data: {
  consultancy: ConsultancyRow;
  client: ClientRow | null | undefined;
  agreement: AgreementRow | null | undefined;
  teamMembers: TeamMemberRow[];
  deliverables: DeliverableRow[];
  departmentsInvolved: string[];
}): WizardState {
  const base = createInitialWizardState({});
  const c = data.consultancy;

  return {
    consultancy: {
      departmentId: c.departmentId,
      academicYearCode: c.academicYearCode,
      consultancyTypeCode: c.consultancyTypeCode,
      teamTypeCode: c.teamTypeCode,
      title: c.title,
      description: c.description ?? "",
      consultancyAreaCode: c.consultancyAreaCode,
      consultancyAreaOther: c.consultancyAreaOther ?? "",
      startDate: c.startDate ?? "",
      expectedCompletionDate: "",
    },
    client: data.client
      ? {
          organizationName: data.client.organizationName,
          organizationTypeCode: data.client.organizationTypeCode,
          organizationTypeOther: data.client.organizationTypeOther ?? "",
          industrySectorCode: data.client.industrySectorCode ?? "",
          contactPersonName: data.client.contactPersonName ?? "",
          designation: data.client.designation ?? "",
          contactEmail: data.client.contactEmail ?? "",
          contactPhone: data.client.contactPhone ?? "",
          address: data.client.address ?? "",
          website: data.client.website ?? "",
          countryCode: data.client.countryCode ?? "",
          stateCode: data.client.stateCode ?? "",
          cityCode: data.client.cityCode ?? "",
        }
      : base.client,
    agreement: data.agreement
      ? {
          agreementTypeCode: data.agreement.agreementTypeCode,
          agreementTypeOther: data.agreement.agreementTypeOther ?? "",
          agreementNumber: data.agreement.agreementNumber ?? "",
          agreementDate: data.agreement.agreementDate ?? "",
          agreementStartDate: data.agreement.agreementStartDate ?? "",
          agreementEndDate: data.agreement.agreementEndDate ?? "",
          agreementValue: data.agreement.agreementValue ?? "",
          paymentTermsCode: data.agreement.paymentTermsCode,
          paymentTermsOther: data.agreement.paymentTermsOther ?? "",
          paymentModeCode: data.agreement.paymentModeCode ?? "",
          paymentModeOther: data.agreement.paymentModeOther ?? "",
          numberOfInstallments: data.agreement.numberOfInstallments?.toString() ?? "",
        }
      : base.agreement,
    team: {
      members:
        data.teamMembers.length > 0
          ? data.teamMembers.map((m) => ({
              name: m.name,
              role: m.role,
              department: m.department ?? "",
              isExternal: m.isExternal,
            }))
          : base.team.members,
      departmentsInvolved: data.departmentsInvolved,
      externalExpertInvolved: c.externalExpertInvolved,
      externalExpertDetails: c.externalExpertDetails ?? "",
      rolesAndResponsibilities: c.rolesAndResponsibilities ?? "",
    },
    financial: {
      totalValue: c.totalValue ?? "",
      currencyCode: c.currencyCode || "INR",
      taxApplicable: c.taxApplicable,
      taxDetails: c.taxDetails ?? "",
      estimatedInstitutionalCosts: c.estimatedInstitutionalCosts ?? "",
      otherApprovedCosts: c.otherApprovedCosts ?? "",
    },
    scope: {
      scopeOfWork: c.scopeOfWork ?? "",
      expectedOutcomes: c.expectedOutcomes ?? "",
      clientAcceptanceRequired: c.clientAcceptanceRequired,
      deliverables:
        data.deliverables.length > 0
          ? data.deliverables.map((d) => ({ description: d.description, dueDate: d.dueDate ?? "" }))
          : base.scope.deliverables,
    },
    resources: {
      ndaRequired: c.ndaRequired,
      ipAgreementRequired: c.ipAgreementRequired,
      caiasResourcesRequired: c.caiasResourcesRequired,
      laboratoryRequired: c.laboratoryRequired,
      equipmentRequired: c.equipmentRequired,
      softwareRequired: c.softwareRequired,
      travelRequired: c.travelRequired,
      externalExpertRequired: c.externalExpertRequired,
      resourceDetails: c.resourceDetails ?? "",
      estimatedResourceCost: c.estimatedResourceCost ?? "",
    },
  };
}
