import type { DeclarationKey } from "@/lib/validation/consultancy";

export type TeamMemberInput = {
  name: string;
  role: string;
  roleOther: string;
  department: string;
  isExternal: boolean;
  employeeId: string;
  designation: string;
  estimatedHours: string;
  contributionPercent: string;
};

export type DeliverableInput = {
  name: string;
  description: string;
  dueDate: string;
  responsibleConsultant: string;
};

export type ExternalExpertInput = {
  name: string;
  organisation: string;
  expertise: string;
  role: string;
  engagementTerms: string;
};

export type MilestoneInput = {
  title: string;
  description: string;
  startDate: string;
  plannedDate: string;
  responsiblePerson: string;
};

export type PaymentStageInput = {
  stageLabel: string;
  plannedAmount: string;
  plannedDate: string;
};

export type ResourceItemInput = {
  resource: string;
  purpose: string;
  estimatedUsage: string;
  facility: string;
  cost: string;
};

export type WizardState = {
  consultancy: {
    agreementSignedStatus: string;
    /** The faculty member the consultancy is for — the signed-in faculty, or whoever an admin picked on their behalf. */
    facultyInChargeId: string;
    departmentId: string;
    departmentCoordinatorId: string;
    academicYearCode: string;
    consultancyTypeCode: string;
    teamTypeCode: string;
    title: string;
    description: string;
    natureOfConsultancyCode: string;
    natureOfConsultancyOther: string;
    consultancyTypeOther: string;
    consultancyDomainCodes: string[];
    consultancyDomainOther: string;
    consultancyCategoryCode: string;
    consultancyAreaCode: string;
    consultancyAreaOther: string;
    clientProblem: string;
    objective: string;
    startDate: string;
    expectedCompletionDate: string;
    reportingFrequency: string;
    reportingFrequencyOther: string;
  };
  client: {
    organizationName: string;
    organizationTypeCode: string;
    organizationTypeOther: string;
    industrySectorCode: string;
    contactPersonName: string;
    designation: string;
    contactEmail: string;
    contactPhone: string;
    contactDepartment: string;
    address: string;
    website: string;
    countryCode: string;
    stateCode: string;
    cityCode: string;
    pinCode: string;
    gstin: string;
    pan: string;
    alternateContactName: string;
    alternateContactEmail: string;
    alternateContactPhone: string;
  };
  agreement: {
    agreementTypeCode: string;
    agreementTypeOther: string;
    agreementNumber: string;
    agreementDate: string;
    agreementStartDate: string;
    agreementEndDate: string;
    agreementValue: string;
    paymentTermsCode: string;
    paymentTermsOther: string;
    paymentModeCode: string;
    paymentModeOther: string;
    numberOfInstallments: string;
    renewalClause: string;
    confidentialityClause: boolean;
    ipClause: boolean;
    paymentTermsIncluded: boolean;
  };
  team: {
    members: TeamMemberInput[];
    departmentsInvolved: string[];
    externalExpertInvolved: boolean;
    externalExpertDetails: string;
    externalExperts: ExternalExpertInput[];
    rolesAndResponsibilities: string;
  };
  financial: {
    totalValue: string;
    currencyCode: string;
    currencyOther: string;
    taxApplicable: boolean;
    taxRatePercent: string;
    taxAmount: string;
    grossTotalValue: string;
    institutionalSharePercent: string;
    institutionalShareAmount: string;
    facultySharePercent: string;
    facultyShareAmount: string;
    taxDetails: string;
    estimatedInstitutionalCosts: string;
    otherApprovedCosts: string;
    paymentSchedule: PaymentStageInput[];
  };
  scope: {
    scopeOfWork: string;
    expectedOutcomes: string;
    clientAcceptanceRequired: boolean;
    deliverables: DeliverableInput[];
  };
  timeline: {
    milestones: MilestoneInput[];
  };
  resources: {
    ndaRequired: boolean;
    ipAgreementRequired: boolean;
    caiasResourcesRequired: boolean;
    laboratoryRequired: boolean;
    equipmentRequired: boolean;
    softwareRequired: boolean;
    travelRequired: boolean;
    externalExpertRequired: boolean;
    resourceDetails: string;
    estimatedResourceCost: string;
    resourceTypeCodes: string[];
    resourceTypeOther: string;
    resourceItems: ResourceItemInput[];
    ipExpected: string;
    ipTypeCodes: string[];
    ipTypeOther: string;
    ipOwnership: string;
    ipCommercialisationRights: string;
    ipRegistrationResponsibility: string;
    ipClauseReference: string;
    confidentialInformation: boolean;
    /** "" = not answered yet */
    ndaAvailable: "" | "yes" | "no";
    confidentialityJustification: string;
  };
  declaration: Record<DeclarationKey, boolean>;
};

export function emptyTeamMember(): TeamMemberInput {
  return {
    name: "",
    role: "",
    roleOther: "",
    department: "",
    isExternal: false,
    employeeId: "",
    designation: "",
    estimatedHours: "",
    contributionPercent: "",
  };
}

export function emptyDeliverable(): DeliverableInput {
  return { name: "", description: "", dueDate: "", responsibleConsultant: "" };
}

export function emptyExternalExpert(): ExternalExpertInput {
  return { name: "", organisation: "", expertise: "", role: "", engagementTerms: "" };
}

export function emptyMilestone(): MilestoneInput {
  return { title: "", description: "", startDate: "", plannedDate: "", responsiblePerson: "" };
}

export function emptyPaymentStage(): PaymentStageInput {
  return { stageLabel: "", plannedAmount: "", plannedDate: "" };
}

export function emptyResourceItem(): ResourceItemInput {
  return { resource: "", purpose: "", estimatedUsage: "", facility: "", cost: "" };
}

export function emptyDeclaration(): Record<DeclarationKey, boolean> {
  return {
    informationAccurate: false,
    undertakenThroughCaias: false,
    agreementExecuted: false,
    paymentsRouted: false,
    resourcesAsDeclared: false,
  };
}

/**
 * The signed-in user, pre-filled as the Principal Consultant (Screen 8:
 * "Select CAIAS faculty/staff. Auto-populate: Name, Employee ID, Department").
 */
export type PrincipalDefaults = {
  name: string;
  employeeId: string;
  departmentName: string;
};

export function createInitialWizardState(defaults: {
  facultyInChargeId?: string;
  departmentId?: string;
  academicYearCode?: string;
  principal?: PrincipalDefaults;
}): WizardState {
  return {
    consultancy: {
      agreementSignedStatus: "",
      facultyInChargeId: defaults.facultyInChargeId ?? "",
      departmentId: defaults.departmentId ?? "",
      departmentCoordinatorId: "",
      academicYearCode: defaults.academicYearCode ?? "",
      consultancyTypeCode: "",
      teamTypeCode: "",
      title: "",
      description: "",
      natureOfConsultancyCode: "",
      natureOfConsultancyOther: "",
      consultancyTypeOther: "",
      consultancyDomainCodes: [],
      consultancyDomainOther: "",
      consultancyCategoryCode: "",
      consultancyAreaCode: "",
      consultancyAreaOther: "",
      clientProblem: "",
      objective: "",
      startDate: "",
      expectedCompletionDate: "",
      reportingFrequency: "monthly",
      reportingFrequencyOther: "",
    },
    client: {
      organizationName: "",
      organizationTypeCode: "",
      organizationTypeOther: "",
      industrySectorCode: "",
      contactPersonName: "",
      designation: "",
      contactEmail: "",
      contactPhone: "",
      contactDepartment: "",
      address: "",
      website: "",
      countryCode: "India",
      stateCode: "",
      cityCode: "",
      pinCode: "",
      gstin: "",
      pan: "",
      alternateContactName: "",
      alternateContactEmail: "",
      alternateContactPhone: "",
    },
    agreement: {
      agreementTypeCode: "",
      agreementTypeOther: "",
      agreementNumber: "",
      agreementDate: "",
      agreementStartDate: "",
      agreementEndDate: "",
      agreementValue: "",
      paymentTermsCode: "",
      paymentTermsOther: "",
      paymentModeCode: "",
      paymentModeOther: "",
      numberOfInstallments: "",
      renewalClause: "",
      confidentialityClause: false,
      ipClause: false,
      paymentTermsIncluded: false,
    },
    team: {
      members: [
        {
          ...emptyTeamMember(),
          name: defaults.principal?.name ?? "",
          employeeId: defaults.principal?.employeeId ?? "",
          department: defaults.principal?.departmentName ?? "",
          role: "principal_consultant",
        },
      ],
      departmentsInvolved: [],
      externalExpertInvolved: false,
      externalExpertDetails: "",
      externalExperts: [],
      rolesAndResponsibilities: "",
    },
    financial: {
      totalValue: "",
      currencyCode: "INR",
      currencyOther: "",
      taxApplicable: false,
      taxRatePercent: "18",
      taxAmount: "0",
      grossTotalValue: "0",
      institutionalSharePercent: "40",
      institutionalShareAmount: "0",
      facultySharePercent: "60",
      facultyShareAmount: "0",
      taxDetails: "",
      estimatedInstitutionalCosts: "",
      otherApprovedCosts: "",
      paymentSchedule: [emptyPaymentStage()],
    },
    scope: {
      scopeOfWork: "",
      expectedOutcomes: "",
      clientAcceptanceRequired: false,
      deliverables: [emptyDeliverable()],
    },
    timeline: {
      milestones: [],
    },
    resources: {
      ndaRequired: false,
      ipAgreementRequired: false,
      caiasResourcesRequired: false,
      laboratoryRequired: false,
      equipmentRequired: false,
      softwareRequired: false,
      travelRequired: false,
      externalExpertRequired: false,
      resourceDetails: "",
      estimatedResourceCost: "",
      resourceTypeCodes: [],
      resourceTypeOther: "",
      resourceItems: [],
      ipExpected: "",
      ipTypeCodes: [],
      ipTypeOther: "",
      ipOwnership: "",
      ipCommercialisationRights: "",
      ipRegistrationResponsibility: "",
      ipClauseReference: "",
      confidentialInformation: false,
      ndaAvailable: "",
      confidentialityJustification: "",
    },
    declaration: emptyDeclaration(),
  };
}

/** Whole days from start to end inclusive of neither bound — "82 Days" on Screen 9. `null` until both dates are valid. */
export function durationInDays(start: string, end: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  return days >= 0 ? days : null;
}

/**
 * Institutional share policy, on the consultancy value before tax:
 * up to ₹1 Lakh -> 40% institutional (60% faculty pool);
 * above ₹1 Lakh -> 20% institutional (80% faculty pool).
 */
export const INSTITUTIONAL_SHARE_THRESHOLD = 100000;

export function institutionalSharePercentFor(consultancyValue: number): number {
  return consultancyValue > INSTITUTIONAL_SHARE_THRESHOLD ? 20 : 40;
}

/**
 * Revenue distribution (all on the consultancy value before tax):
 *   Distributable Amount = Consultancy Value − Other Approved Costs (CAIAS resources used)
 *   Institutional Share  = 40% / 20% of the Distributable Amount (rate from the consultancy value, see above)
 *   Institute receives   = Institutional Share + the resource cost, reimbursed
 *   Faculty Pool         = the rest of the Distributable Amount
 * so Institute receives + Faculty Pool = Consultancy Value.
 */
export function computeFinancialCalculations(totalValueStr: string, taxApplicable: boolean, taxRatePercentStr: string, resourceCostStr = "0") {
  const val = Number(totalValueStr) || 0;
  const taxRate = taxApplicable ? Number(taxRatePercentStr) || 0 : 0;
  const taxAmount = (val * taxRate) / 100;
  const grossTotalValue = val + taxAmount;

  // Resource costs can't exceed the value they're deducted from.
  const otherApprovedCosts = Math.min(Math.max(Number(resourceCostStr) || 0, 0), val);
  const distributableAmount = val - otherApprovedCosts;

  const instSharePct = institutionalSharePercentFor(val);
  const facultySharePct = 100 - instSharePct;

  const institutionalShareAmount = (distributableAmount * instSharePct) / 100;
  const facultyShareAmount = (distributableAmount * facultySharePct) / 100;

  return {
    taxAmount: taxAmount.toFixed(2),
    grossTotalValue: grossTotalValue.toFixed(2),
    otherApprovedCosts: otherApprovedCosts.toFixed(2),
    distributableAmount: distributableAmount.toFixed(2),
    institutionalSharePercent: String(instSharePct),
    institutionalShareAmount: institutionalShareAmount.toFixed(2),
    instituteTotalAmount: (institutionalShareAmount + otherApprovedCosts).toFixed(2),
    facultySharePercent: String(facultySharePct),
    facultyShareAmount: facultyShareAmount.toFixed(2),
  };
}

export type RevenueLine = { label: string; amount: string; strong?: boolean };

/** The distribution as the rows of the "Revenue Distribution" statement (web, review, record and PDF). */
export function revenueDistributionLines(calc: ReturnType<typeof computeFinancialCalculations>, value: string, format: (n: number) => string): RevenueLine[] {
  const n = (s: string) => Number(s) || 0;
  const resource = n(calc.otherApprovedCosts);
  const distributable = format(n(calc.distributableAmount));
  return [
    { label: "Net Consultancy Value", amount: format(n(value)) },
    { label: "Less: Other Approved Costs (CAIAS resources)", amount: resource > 0 ? `−${format(resource)}` : format(0) },
    { label: "Distributable Amount", amount: distributable, strong: true },
    { label: `Institutional Share (${calc.institutionalSharePercent}% of ${distributable})`, amount: format(n(calc.institutionalShareAmount)) },
    { label: "+ Resource cost reimbursement", amount: resource > 0 ? `+${format(resource)}` : format(0) },
    { label: "Institute receives (total)", amount: format(n(calc.instituteTotalAmount)), strong: true },
    { label: `Faculty Pool (${calc.facultySharePercent}% of ${distributable})`, amount: format(n(calc.facultyShareAmount)), strong: true },
    {
      label: `Check: ${format(n(calc.instituteTotalAmount))} + ${format(n(calc.facultyShareAmount))}`,
      amount: `= ${format(n(calc.instituteTotalAmount) + n(calc.facultyShareAmount))}`,
      strong: true,
    },
  ];
}

/** Total estimated cost of the CAIAS resources listed on the Resources step (0 when none are used). */
export function resourceCostTotal(resources: { caiasResourcesRequired: boolean; resourceItems: { cost?: string | null }[] }): number {
  if (!resources.caiasResourcesRequired) return 0;
  return resources.resourceItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

