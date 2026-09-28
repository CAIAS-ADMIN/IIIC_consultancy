import { computeFinancialCalculations, resourceCostTotal, type WizardState } from "./types";

function orUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function cleanTeamMembers(members: WizardState["team"]["members"]) {
  return members
    .filter((m) => m.name.trim() !== "" || m.role.trim() !== "")
    .map((m) => ({
      name: m.name.trim(),
      role: m.role.trim(),
      roleOther: m.role === "other" ? orUndefined(m.roleOther) : undefined,
      department: orUndefined(m.department),
      isExternal: m.isExternal,
      employeeId: orUndefined(m.employeeId),
      designation: orUndefined(m.designation),
      estimatedHours: orUndefined(m.estimatedHours),
      contributionPercent: orUndefined(m.contributionPercent),
    }));
}

function cleanDeliverables(deliverables: WizardState["scope"]["deliverables"]) {
  return deliverables
    .filter((d) => d.name.trim() !== "" || d.description.trim() !== "")
    .map((d) => ({
      name: d.name.trim(),
      description: orUndefined(d.description),
      dueDate: orUndefined(d.dueDate),
      responsibleConsultant: orUndefined(d.responsibleConsultant),
    }));
}

function cleanExternalExperts(experts: WizardState["team"]["externalExperts"]) {
  return experts
    .filter((e) => Object.values(e).some((v) => v.trim() !== ""))
    .map((e) => ({
      name: e.name.trim(),
      organisation: e.organisation.trim(),
      expertise: orUndefined(e.expertise),
      role: e.role.trim(),
      engagementTerms: orUndefined(e.engagementTerms),
    }));
}

function cleanMilestones(milestones: WizardState["timeline"]["milestones"]) {
  return milestones
    .filter((m) => Object.values(m).some((v) => v.trim() !== ""))
    .map((m) => ({
      title: m.title.trim(),
      description: m.description.trim(),
      startDate: m.startDate,
      plannedDate: m.plannedDate,
      responsiblePerson: m.responsiblePerson.trim(),
    }));
}

function cleanPaymentSchedule(rows: WizardState["financial"]["paymentSchedule"]) {
  return rows
    .filter((r) => Object.values(r).some((v) => v.trim() !== ""))
    .map((r) => ({ stageLabel: r.stageLabel.trim(), plannedAmount: r.plannedAmount.trim(), plannedDate: r.plannedDate }));
}

function cleanResourceItems(items: WizardState["resources"]["resourceItems"]) {
  return items
    .filter((i) => Object.values(i).some((v) => v.trim() !== ""))
    .map((i) => ({
      resource: i.resource.trim(),
      purpose: i.purpose.trim(),
      estimatedUsage: orUndefined(i.estimatedUsage),
      facility: orUndefined(i.facility),
      cost: orUndefined(i.cost),
    }));
}

/**
 * The spec's resource checklist (Screen 11) supersedes the older five
 * resource booleans, but those columns still drive reports and filters —
 * so they're derived from the checklist rather than asked for twice.
 */
function resourceFlags(state: WizardState) {
  const r = state.resources;
  const on = (code: string) => r.caiasResourcesRequired && r.resourceTypeCodes.includes(code);
  return {
    laboratoryRequired: on("laboratory"),
    equipmentRequired: on("equipment"),
    softwareRequired: on("software"),
    travelRequired: on("travel"),
    externalExpertRequired: state.team.externalExpertInvolved,
    // NDA / IP-agreement document requirements follow from the Screen 12 answers.
    ndaRequired: r.confidentialInformation && r.ndaAvailable === "yes",
    ipAgreementRequired: r.ipExpected === "yes",
  };
}

/**
 * Estimated Institutional Costs = the institutional share of the value (40% up
 * to ₹1 Lakh, 20% above); Other Approved Costs = the total estimated cost of
 * the CAIAS resources listed on the Resources step. Both are derived, never typed.
 */
export function derivedCosts(state: WizardState): { estimatedInstitutionalCosts: string | undefined; otherApprovedCosts: string | undefined } {
  const f = state.financial;
  const resourceTotal = resourceCostTotal(state.resources);
  return {
    estimatedInstitutionalCosts:
      Number(f.totalValue) > 0 ? computeFinancialCalculations(f.totalValue, false, "0", String(resourceTotal)).institutionalShareAmount : undefined,
    otherApprovedCosts: resourceTotal > 0 ? resourceTotal.toFixed(2) : undefined,
  };
}

/** The minimal set `draftConsultancySchema` needs to create the row — enough to unblock "Save Draft" the first time it's called, from any step. */
export function buildDraftMinimal(state: WizardState) {
  return {
    // Only honoured server-side for an admin filling the form on a faculty member's behalf.
    facultyInChargeId: orUndefined(state.consultancy.facultyInChargeId),
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

function consultancySection(state: WizardState) {
  const c = state.consultancy;
  return {
    ...buildDraftMinimal(state),
    departmentCoordinatorId: orUndefined(c.departmentCoordinatorId),
    agreementSignedStatus: c.agreementSignedStatus || undefined,
    natureOfConsultancyCode: c.natureOfConsultancyCode,
    natureOfConsultancyOther: orUndefined(c.natureOfConsultancyOther),
    consultancyTypeOther: c.consultancyTypeCode === "other" ? orUndefined(c.consultancyTypeOther) : undefined,
    consultancyDomainCodes: c.consultancyDomainCodes,
    consultancyDomainOther: c.consultancyDomainCodes.includes("other") ? orUndefined(c.consultancyDomainOther) : undefined,
    consultancyCategoryCode: orUndefined(c.consultancyCategoryCode),
    clientProblem: c.clientProblem.trim(),
    objective: c.objective.trim(),
    reportingFrequency: c.reportingFrequency,
    reportingFrequencyOther: orUndefined(c.reportingFrequencyOther),
  };
}

function clientSection(state: WizardState) {
  const c = state.client;
  return {
    organizationName: c.organizationName.trim(),
    organizationTypeCode: c.organizationTypeCode,
    organizationTypeOther: orUndefined(c.organizationTypeOther),
    industrySectorCode: orUndefined(c.industrySectorCode),
    contactPersonName: orUndefined(c.contactPersonName),
    designation: orUndefined(c.designation),
    contactEmail: orUndefined(c.contactEmail),
    contactPhone: orUndefined(c.contactPhone),
    contactDepartment: orUndefined(c.contactDepartment),
    address: orUndefined(c.address),
    website: orUndefined(c.website),
    countryCode: orUndefined(c.countryCode),
    stateCode: orUndefined(c.stateCode),
    cityCode: orUndefined(c.cityCode),
    pinCode: orUndefined(c.pinCode),
    gstin: orUndefined(c.gstin),
    pan: orUndefined(c.pan),
    alternateContactName: orUndefined(c.alternateContactName),
    alternateContactEmail: orUndefined(c.alternateContactEmail),
    alternateContactPhone: orUndefined(c.alternateContactPhone),
  };
}

function agreementSection(state: WizardState) {
  const a = state.agreement;
  return {
    agreementTypeCode: a.agreementTypeCode,
    agreementTypeOther: orUndefined(a.agreementTypeOther),
    agreementNumber: orUndefined(a.agreementNumber),
    agreementDate: orUndefined(a.agreementDate),
    agreementStartDate: orUndefined(a.agreementStartDate),
    agreementEndDate: orUndefined(a.agreementEndDate),
    // Screen 10 has one "Total Consultancy Value" — the agreement value mirrors it.
    agreementValue: orUndefined(state.financial.totalValue),
    paymentTermsCode: a.paymentTermsCode,
    paymentTermsOther: orUndefined(a.paymentTermsOther),
    paymentModeCode: orUndefined(a.paymentModeCode),
    paymentModeOther: orUndefined(a.paymentModeOther),
    numberOfInstallments: a.numberOfInstallments ? Number(a.numberOfInstallments) : undefined,
    renewalClause: orUndefined(a.renewalClause),
    confidentialityClause: a.confidentialityClause,
    ipClause: a.ipClause,
    paymentTermsIncluded: a.paymentTermsIncluded,
  };
}

function resourcesSection(state: WizardState) {
  const r = state.resources;
  return {
    ...resourceFlags(state),
    caiasResourcesRequired: r.caiasResourcesRequired,
    resourceDetails: orUndefined(r.resourceDetails),
    // The total of the per-resource costs when any are entered; otherwise whatever was entered directly.
    estimatedResourceCost: r.caiasResourcesRequired && r.resourceItems.some((i) => i.cost.trim() !== "")
      ? r.resourceItems.reduce((sum, i) => sum + (Number(i.cost) || 0), 0).toFixed(2)
      : orUndefined(r.estimatedResourceCost),
    resourceTypeCodes: r.caiasResourcesRequired ? r.resourceTypeCodes : [],
    resourceTypeOther: r.caiasResourcesRequired && r.resourceTypeCodes.includes("other") ? orUndefined(r.resourceTypeOther) : undefined,
    resourceItems: r.caiasResourcesRequired ? cleanResourceItems(r.resourceItems) : [],
    ipExpected: r.ipExpected || undefined,
    ipTypeCodes: r.ipExpected === "yes" ? r.ipTypeCodes : [],
    ipTypeOther: r.ipExpected === "yes" && r.ipTypeCodes.includes("other") ? orUndefined(r.ipTypeOther) : undefined,
    ipOwnership: orUndefined(r.ipOwnership),
    ipCommercialisationRights: orUndefined(r.ipCommercialisationRights),
    ipRegistrationResponsibility: orUndefined(r.ipRegistrationResponsibility),
    ipClauseReference: orUndefined(r.ipClauseReference),
    confidentialInformation: r.confidentialInformation,
    ndaAvailable: r.confidentialInformation && r.ndaAvailable !== "" ? r.ndaAvailable === "yes" : undefined,
    confidentialityJustification: orUndefined(r.confidentialityJustification),
  };
}

/**
 * Everything "Save Draft" can persist through `PATCH /api/consultancies/:id`
 * — plain consultancy columns flattened to the top level, `client`/`agreement`
 * nested, and the child-table sections (team, deliverables, milestones,
 * payment schedule, departments involved) as separate arrays.
 * `originalCompletionDate` holds the expected completion date while drafting;
 * `submit` re-sets it together with `currentCompletionDate`.
 */
export function buildDraftPatchBody(state: WizardState) {
  const resources = resourcesSection(state);
  return {
    ...consultancySection(state),
    agreementSignedStatus: state.consultancy.agreementSignedStatus || null,
    startDate: orUndefined(state.consultancy.startDate),
    originalCompletionDate: orUndefined(state.consultancy.expectedCompletionDate),

    scopeOfWork: orUndefined(state.scope.scopeOfWork),
    expectedOutcomes: orUndefined(state.scope.expectedOutcomes),
    clientAcceptanceRequired: state.scope.clientAcceptanceRequired,

    ...resources,
    ipExpected: resources.ipExpected ?? null,
    ndaAvailable: resources.ndaAvailable ?? null,

    externalExpertInvolved: state.team.externalExpertInvolved,
    externalExpertDetails: orUndefined(state.team.externalExpertDetails),
    externalExperts: cleanExternalExperts(state.team.externalExperts),
    rolesAndResponsibilities: orUndefined(state.team.rolesAndResponsibilities),

    totalValue: orUndefined(state.financial.totalValue),
    currencyCode: state.financial.currencyCode || "INR",
    currencyOther: state.financial.currencyCode === "other" ? orUndefined(state.financial.currencyOther) : undefined,
    taxApplicable: state.financial.taxApplicable,
    // Explicit nulls so switching tax off (or clearing a cost) clears the saved value too.
    taxRatePercent: state.financial.taxApplicable ? (orUndefined(state.financial.taxRatePercent) ?? null) : null,
    taxAmount: state.financial.taxApplicable ? (orUndefined(state.financial.taxAmount) ?? null) : null,
    taxDetails: orUndefined(state.financial.taxDetails),
    ...derivedCosts(state),

    client: clientSection(state),
    agreement: agreementSection(state),

    teamMembers: cleanTeamMembers(state.team.members),
    deliverables: cleanDeliverables(state.scope.deliverables),
    milestones: cleanMilestones(state.timeline.milestones),
    paymentSchedule: cleanPaymentSchedule(state.financial.paymentSchedule),
    departmentsInvolved: state.team.departmentsInvolved,
  };
}

/** The full nested shape `submitConsultancySchema` expects — validate this with that schema before ever sending it. */
export function buildSubmitPayload(state: WizardState) {
  return {
    consultancy: {
      ...consultancySection(state),
      startDate: state.consultancy.startDate,
      expectedCompletionDate: state.consultancy.expectedCompletionDate,
    },
    client: clientSection(state),
    agreement: agreementSection(state),
    team: {
      members: cleanTeamMembers(state.team.members),
      departmentsInvolved: state.team.departmentsInvolved,
      externalExpertInvolved: state.team.externalExpertInvolved,
      externalExpertDetails: orUndefined(state.team.externalExpertDetails),
      externalExperts: state.team.externalExpertInvolved ? cleanExternalExperts(state.team.externalExperts) : [],
      rolesAndResponsibilities: orUndefined(state.team.rolesAndResponsibilities),
    },
    financial: {
      totalValue: state.financial.totalValue,
      currencyCode: state.financial.currencyCode || "INR",
      currencyOther: state.financial.currencyCode === "other" ? orUndefined(state.financial.currencyOther) : undefined,
      taxApplicable: state.financial.taxApplicable,
      taxRatePercent: state.financial.taxRatePercent,
      taxAmount: state.financial.taxAmount,
      grossTotalValue: state.financial.grossTotalValue,
      institutionalSharePercent: state.financial.institutionalSharePercent,
      institutionalShareAmount: state.financial.institutionalShareAmount,
      facultySharePercent: state.financial.facultySharePercent,
      facultyShareAmount: state.financial.facultyShareAmount,
      taxDetails: orUndefined(state.financial.taxDetails),
      ...derivedCosts(state),
      paymentSchedule: cleanPaymentSchedule(state.financial.paymentSchedule),
    },
    scope: {
      scopeOfWork: state.scope.scopeOfWork.trim(),
      expectedOutcomes: state.scope.expectedOutcomes.trim(),
      clientAcceptanceRequired: state.scope.clientAcceptanceRequired,
      deliverables: cleanDeliverables(state.scope.deliverables),
    },
    timeline: {
      milestones: cleanMilestones(state.timeline.milestones),
    },
    resources: resourcesSection(state),
    declaration: state.declaration,
  };
}
