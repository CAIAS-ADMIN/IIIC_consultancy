import type {
  consultancies,
  clients,
  agreements,
  consultancyTeamMembers,
  deliverables,
  milestones,
  paymentSchedules,
} from "@/db/schema";
import { computeFinancialCalculations, createInitialWizardState, emptyDeclaration, resourceCostTotal, type WizardState } from "./types";

type ConsultancyRow = typeof consultancies.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type AgreementRow = typeof agreements.$inferSelect;
type TeamMemberRow = typeof consultancyTeamMembers.$inferSelect;
type DeliverableRow = typeof deliverables.$inferSelect;
type MilestoneRow = typeof milestones.$inferSelect;
type PaymentScheduleRow = typeof paymentSchedules.$inferSelect;

/**
 * Rebuilds wizard form state from a draft's persisted rows (resume flow).
 * The declaration is deliberately never restored — it's re-confirmed at
 * each submission.
 */
export function wizardStateFromDraft(data: {
  consultancy: ConsultancyRow;
  client: ClientRow | null | undefined;
  agreement: AgreementRow | null | undefined;
  teamMembers: TeamMemberRow[];
  deliverables: DeliverableRow[];
  milestones: MilestoneRow[];
  paymentSchedule: PaymentScheduleRow[];
  departmentsInvolved: string[];
}): WizardState {
  const base = createInitialWizardState({});
  const c = data.consultancy;
  const cl = data.client;
  const a = data.agreement;

  return {
    consultancy: {
      agreementSignedStatus: c.agreementSignedStatus ?? "",
      facultyInChargeId: c.facultyInChargeId,
      departmentId: c.departmentId,
      departmentCoordinatorId: c.departmentCoordinatorId ?? "",
      academicYearCode: c.academicYearCode,
      consultancyTypeCode: c.consultancyTypeCode,
      teamTypeCode: c.teamTypeCode,
      title: c.title,
      description: c.description ?? "",
      natureOfConsultancyCode: c.natureOfConsultancyCode ?? "",
      natureOfConsultancyOther: c.natureOfConsultancyOther ?? "",
      consultancyTypeOther: c.consultancyTypeOther ?? "",
      consultancyDomainCodes: c.consultancyDomainCodes ?? [],
      consultancyDomainOther: c.consultancyDomainOther ?? "",
      consultancyCategoryCode: c.consultancyCategoryCode ?? "",
      consultancyAreaCode: c.consultancyAreaCode,
      consultancyAreaOther: c.consultancyAreaOther ?? "",
      clientProblem: c.clientProblem ?? "",
      objective: c.objective ?? "",
      startDate: c.startDate ?? "",
      expectedCompletionDate: c.originalCompletionDate ?? "",
      reportingFrequency: c.reportingFrequency ?? base.consultancy.reportingFrequency,
      reportingFrequencyOther: c.reportingFrequencyOther ?? "",
    },
    client: cl
      ? {
          organizationName: cl.organizationName,
          organizationTypeCode: cl.organizationTypeCode,
          organizationTypeOther: cl.organizationTypeOther ?? "",
          industrySectorCode: cl.industrySectorCode ?? "",
          contactPersonName: cl.contactPersonName ?? "",
          designation: cl.designation ?? "",
          contactEmail: cl.contactEmail ?? "",
          contactPhone: cl.contactPhone ?? "",
          contactDepartment: cl.contactDepartment ?? "",
          address: cl.address ?? "",
          website: cl.website ?? "",
          countryCode: cl.countryCode ?? "",
          stateCode: cl.stateCode ?? "",
          cityCode: cl.cityCode ?? "",
          pinCode: cl.pinCode ?? "",
          gstin: cl.gstin ?? "",
          pan: cl.pan ?? "",
          alternateContactName: cl.alternateContactName ?? "",
          alternateContactEmail: cl.alternateContactEmail ?? "",
          alternateContactPhone: cl.alternateContactPhone ?? "",
        }
      : base.client,
    agreement: a
      ? {
          agreementTypeCode: a.agreementTypeCode,
          agreementTypeOther: a.agreementTypeOther ?? "",
          agreementNumber: a.agreementNumber ?? "",
          agreementDate: a.agreementDate ?? "",
          agreementStartDate: a.agreementStartDate ?? "",
          agreementEndDate: a.agreementEndDate ?? "",
          agreementValue: a.agreementValue ?? "",
          paymentTermsCode: a.paymentTermsCode,
          paymentTermsOther: a.paymentTermsOther ?? "",
          paymentModeCode: a.paymentModeCode ?? "",
          paymentModeOther: a.paymentModeOther ?? "",
          numberOfInstallments: a.numberOfInstallments?.toString() ?? "",
          renewalClause: a.renewalClause ?? "",
          confidentialityClause: a.confidentialityClause ?? false,
          ipClause: a.ipClause ?? false,
          paymentTermsIncluded: a.paymentTermsIncluded ?? false,
        }
      : base.agreement,
    team: {
      members:
        data.teamMembers.length > 0
          ? data.teamMembers.map((m) => ({
              name: m.name,
              role: m.role,
              roleOther: m.roleOther ?? "",
              department: m.department ?? "",
              isExternal: m.isExternal,
              employeeId: m.employeeId ?? "",
              designation: m.designation ?? "",
              estimatedHours: m.estimatedHours ?? "",
              contributionPercent: m.contributionPercent ?? "",
            }))
          : base.team.members,
      departmentsInvolved: data.departmentsInvolved,
      externalExpertInvolved: c.externalExpertInvolved,
      externalExpertDetails: c.externalExpertDetails ?? "",
      externalExperts: (c.externalExperts ?? []).map((e) => ({
        name: e.name,
        organisation: e.organisation,
        expertise: e.expertise ?? "",
        role: e.role,
        engagementTerms: e.engagementTerms ?? "",
      })),
      rolesAndResponsibilities: c.rolesAndResponsibilities ?? "",
    },
    financial: (() => {
      const taxRate = c.taxRatePercent ? String(Number(c.taxRatePercent)) : "18";
      const calc = computeFinancialCalculations(c.totalValue ?? "", c.taxApplicable, taxRate, String(resourceCostTotal(c)));
      return {
        totalValue: c.totalValue ?? "",
        currencyCode: c.currencyCode || "INR",
        currencyOther: c.currencyOther ?? "",
        taxApplicable: c.taxApplicable,
        taxRatePercent: taxRate,
        taxAmount: calc.taxAmount,
        grossTotalValue: calc.grossTotalValue,
        institutionalSharePercent: calc.institutionalSharePercent,
        institutionalShareAmount: calc.institutionalShareAmount,
        facultySharePercent: calc.facultySharePercent,
        facultyShareAmount: calc.facultyShareAmount,
        taxDetails: c.taxDetails ?? "",
        estimatedInstitutionalCosts: c.estimatedInstitutionalCosts ?? "",
        otherApprovedCosts: c.otherApprovedCosts ?? "",
        paymentSchedule:
          data.paymentSchedule.length > 0
            ? data.paymentSchedule.map((p) => ({
                stageLabel: p.stageLabel,
                plannedAmount: p.plannedAmount,
                plannedDate: p.plannedDate ?? "",
              }))
            : base.financial.paymentSchedule,
      };
    })(),
    scope: {
      scopeOfWork: c.scopeOfWork ?? "",
      expectedOutcomes: c.expectedOutcomes ?? "",
      clientAcceptanceRequired: c.clientAcceptanceRequired,
      deliverables:
        data.deliverables.length > 0
          ? data.deliverables.map((d) => ({
              name: d.name ?? d.description ?? "",
              description: d.name ? (d.description ?? "") : "",
              dueDate: d.dueDate ?? "",
              responsibleConsultant: d.responsibleConsultant ?? "",
            }))
          : base.scope.deliverables,
    },
    timeline: {
      milestones: data.milestones.map((m) => ({
        title: m.title,
        description: m.description ?? "",
        startDate: m.startDate ?? "",
        plannedDate: m.plannedDate,
        responsiblePerson: m.responsiblePerson ?? "",
      })),
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
      resourceTypeCodes: c.resourceTypeCodes ?? [],
      resourceTypeOther: c.resourceTypeOther ?? "",
      resourceItems: (c.resourceItems ?? []).map((i) => ({
        resource: i.resource,
        purpose: i.purpose,
        estimatedUsage: i.estimatedUsage ?? "",
        facility: i.facility ?? "",
        cost: i.cost ?? "",
      })),
      ipExpected: c.ipExpected ?? "",
      ipTypeCodes: c.ipTypeCodes ?? [],
      ipTypeOther: c.ipTypeOther ?? "",
      ipOwnership: c.ipOwnership ?? "",
      ipCommercialisationRights: c.ipCommercialisationRights ?? "",
      ipRegistrationResponsibility: c.ipRegistrationResponsibility ?? "",
      ipClauseReference: c.ipClauseReference ?? "",
      confidentialInformation: c.confidentialInformation,
      ndaAvailable: c.ndaAvailable === null || c.ndaAvailable === undefined ? "" : c.ndaAvailable ? "yes" : "no",
      confidentialityJustification: c.confidentialityJustification ?? "",
    },
    declaration: emptyDeclaration(),
  };
}
