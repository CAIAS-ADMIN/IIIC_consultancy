import type { WizardState } from "./types";

function orUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function cleanTeamMembers(members: WizardState["team"]["members"]) {
  return members
    .filter((m) => m.name.trim() !== "" && m.role.trim() !== "")
    .map((m) => ({
      name: m.name.trim(),
      role: m.role.trim(),
      department: orUndefined(m.department),
      isExternal: m.isExternal,
    }));
}

function cleanDeliverables(deliverables: WizardState["scope"]["deliverables"]) {
  return deliverables
    .filter((d) => d.description.trim() !== "")
    .map((d) => ({ description: d.description.trim(), dueDate: orUndefined(d.dueDate) }));
}

/** The minimal set `draftConsultancySchema` needs to create the row — enough to unblock "Save Draft" the first time it's called, from any step. */
export function buildDraftMinimal(state: WizardState) {
  return {
    departmentId: state.consultancy.departmentId,
    academicYearCode: state.consultancy.academicYearCode,
    consultancyTypeCode: state.consultancy.consultancyTypeCode,
    teamTypeCode: state.consultancy.teamTypeCode,
    title: state.consultancy.title.trim(),
    description: orUndefined(state.consultancy.description),
    consultancyAreaCode: state.consultancy.consultancyAreaCode,
    consultancyAreaOther: orUndefined(state.consultancy.consultancyAreaOther),
  };
}

/**
 * Everything else "Save Draft" can persist through `PATCH /api/consultancies/:id`
 * — plain consultancy columns flattened to the top level (matching that
 * route's `consultancyFields` spread), `client`/`agreement` nested, and
 * `teamMembers`/`deliverables`/`departmentsInvolved` as separate arrays.
 * Deliberately excludes `expectedCompletionDate` — there's no draft-stage
 * column for it (`submit` is what turns it into `original`/`currentCompletionDate`),
 * so it can't be saved before the final submit and isn't restorable on resume.
 */
export function buildDraftPatchBody(state: WizardState) {
  return {
    ...buildDraftMinimal(state),
    startDate: orUndefined(state.consultancy.startDate),

    scopeOfWork: orUndefined(state.scope.scopeOfWork),
    expectedOutcomes: orUndefined(state.scope.expectedOutcomes),
    clientAcceptanceRequired: state.scope.clientAcceptanceRequired,

    ndaRequired: state.resources.ndaRequired,
    ipAgreementRequired: state.resources.ipAgreementRequired,
    caiasResourcesRequired: state.resources.caiasResourcesRequired,
    laboratoryRequired: state.resources.laboratoryRequired,
    equipmentRequired: state.resources.equipmentRequired,
    softwareRequired: state.resources.softwareRequired,
    travelRequired: state.resources.travelRequired,
    externalExpertRequired: state.resources.externalExpertRequired,
    resourceDetails: orUndefined(state.resources.resourceDetails),
    estimatedResourceCost: orUndefined(state.resources.estimatedResourceCost),

    externalExpertInvolved: state.team.externalExpertInvolved,
    externalExpertDetails: orUndefined(state.team.externalExpertDetails),
    rolesAndResponsibilities: orUndefined(state.team.rolesAndResponsibilities),

    totalValue: orUndefined(state.financial.totalValue),
    currencyCode: state.financial.currencyCode || "INR",
    taxApplicable: state.financial.taxApplicable,
    taxDetails: orUndefined(state.financial.taxDetails),
    estimatedInstitutionalCosts: orUndefined(state.financial.estimatedInstitutionalCosts),
    otherApprovedCosts: orUndefined(state.financial.otherApprovedCosts),

    client: state.client,
    agreement: {
      ...state.agreement,
      agreementTypeOther: orUndefined(state.agreement.agreementTypeOther),
      agreementNumber: orUndefined(state.agreement.agreementNumber),
      agreementDate: orUndefined(state.agreement.agreementDate),
      agreementStartDate: orUndefined(state.agreement.agreementStartDate),
      agreementEndDate: orUndefined(state.agreement.agreementEndDate),
      paymentTermsOther: orUndefined(state.agreement.paymentTermsOther),
      paymentModeCode: orUndefined(state.agreement.paymentModeCode),
      paymentModeOther: orUndefined(state.agreement.paymentModeOther),
      numberOfInstallments: state.agreement.numberOfInstallments
        ? Number(state.agreement.numberOfInstallments)
        : undefined,
    },

    teamMembers: cleanTeamMembers(state.team.members),
    deliverables: cleanDeliverables(state.scope.deliverables),
    departmentsInvolved: state.team.departmentsInvolved,
  };
}

/** The full nested shape `submitConsultancySchema` expects — validate this with that schema before ever sending it. */
export function buildSubmitPayload(state: WizardState) {
  return {
    consultancy: {
      ...buildDraftMinimal(state),
      startDate: state.consultancy.startDate,
      expectedCompletionDate: state.consultancy.expectedCompletionDate,
    },
    client: {
      organizationName: state.client.organizationName.trim(),
      organizationTypeCode: state.client.organizationTypeCode,
      organizationTypeOther: orUndefined(state.client.organizationTypeOther),
      industrySectorCode: orUndefined(state.client.industrySectorCode),
      contactPersonName: orUndefined(state.client.contactPersonName),
      designation: orUndefined(state.client.designation),
      contactEmail: orUndefined(state.client.contactEmail),
      contactPhone: orUndefined(state.client.contactPhone),
      address: orUndefined(state.client.address),
      website: orUndefined(state.client.website),
      countryCode: orUndefined(state.client.countryCode),
      stateCode: orUndefined(state.client.stateCode),
      cityCode: orUndefined(state.client.cityCode),
    },
    agreement: {
      agreementTypeCode: state.agreement.agreementTypeCode,
      agreementTypeOther: orUndefined(state.agreement.agreementTypeOther),
      agreementNumber: orUndefined(state.agreement.agreementNumber),
      agreementDate: orUndefined(state.agreement.agreementDate),
      agreementStartDate: orUndefined(state.agreement.agreementStartDate),
      agreementEndDate: orUndefined(state.agreement.agreementEndDate),
      agreementValue: state.agreement.agreementValue,
      paymentTermsCode: state.agreement.paymentTermsCode,
      paymentTermsOther: orUndefined(state.agreement.paymentTermsOther),
      paymentModeCode: orUndefined(state.agreement.paymentModeCode),
      paymentModeOther: orUndefined(state.agreement.paymentModeOther),
      numberOfInstallments: state.agreement.numberOfInstallments
        ? Number(state.agreement.numberOfInstallments)
        : undefined,
    },
    team: {
      members: cleanTeamMembers(state.team.members),
      departmentsInvolved: state.team.departmentsInvolved,
      externalExpertInvolved: state.team.externalExpertInvolved,
      externalExpertDetails: orUndefined(state.team.externalExpertDetails),
      rolesAndResponsibilities: orUndefined(state.team.rolesAndResponsibilities),
    },
    financial: {
      totalValue: state.financial.totalValue,
      currencyCode: state.financial.currencyCode || "INR",
      taxApplicable: state.financial.taxApplicable,
      taxDetails: orUndefined(state.financial.taxDetails),
      estimatedInstitutionalCosts: orUndefined(state.financial.estimatedInstitutionalCosts),
      otherApprovedCosts: orUndefined(state.financial.otherApprovedCosts),
    },
    scope: {
      scopeOfWork: state.scope.scopeOfWork.trim(),
      expectedOutcomes: orUndefined(state.scope.expectedOutcomes),
      clientAcceptanceRequired: state.scope.clientAcceptanceRequired,
      deliverables: cleanDeliverables(state.scope.deliverables),
    },
    resources: {
      ndaRequired: state.resources.ndaRequired,
      ipAgreementRequired: state.resources.ipAgreementRequired,
      caiasResourcesRequired: state.resources.caiasResourcesRequired,
      laboratoryRequired: state.resources.laboratoryRequired,
      equipmentRequired: state.resources.equipmentRequired,
      softwareRequired: state.resources.softwareRequired,
      travelRequired: state.resources.travelRequired,
      externalExpertRequired: state.resources.externalExpertRequired,
      resourceDetails: orUndefined(state.resources.resourceDetails),
      estimatedResourceCost: orUndefined(state.resources.estimatedResourceCost),
    },
  };
}
