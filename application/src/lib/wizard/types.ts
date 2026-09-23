export type TeamMemberInput = {
  name: string;
  role: string;
  department: string;
  isExternal: boolean;
};

export type DeliverableInput = {
  description: string;
  dueDate: string;
};

/** Form-bound shape (everything a string/boolean, matching HTML inputs) — parsed/validated against the real zod schemas from `@/lib/validation/consultancy` before save/submit. */
export type WizardState = {
  consultancy: {
    departmentId: string;
    academicYearCode: string;
    consultancyTypeCode: string;
    teamTypeCode: string;
    title: string;
    description: string;
    consultancyAreaCode: string;
    consultancyAreaOther: string;
    startDate: string;
    expectedCompletionDate: string;
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
    address: string;
    website: string;
    countryCode: string;
    stateCode: string;
    cityCode: string;
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
  };
  team: {
    members: TeamMemberInput[];
    departmentsInvolved: string[];
    externalExpertInvolved: boolean;
    externalExpertDetails: string;
    rolesAndResponsibilities: string;
  };
  financial: {
    totalValue: string;
    currencyCode: string;
    taxApplicable: boolean;
    taxDetails: string;
    estimatedInstitutionalCosts: string;
    otherApprovedCosts: string;
  };
  scope: {
    scopeOfWork: string;
    expectedOutcomes: string;
    clientAcceptanceRequired: boolean;
    deliverables: DeliverableInput[];
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
  };
};

export function emptyTeamMember(): TeamMemberInput {
  return { name: "", role: "", department: "", isExternal: false };
}

export function emptyDeliverable(): DeliverableInput {
  return { description: "", dueDate: "" };
}

export function createInitialWizardState(defaults: {
  departmentId?: string;
  academicYearCode?: string;
  facultyName?: string;
}): WizardState {
  return {
    consultancy: {
      departmentId: defaults.departmentId ?? "",
      academicYearCode: defaults.academicYearCode ?? "",
      consultancyTypeCode: "",
      teamTypeCode: "",
      title: "",
      description: "",
      consultancyAreaCode: "",
      consultancyAreaOther: "",
      startDate: "",
      expectedCompletionDate: "",
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
      address: "",
      website: "",
      countryCode: "",
      stateCode: "",
      cityCode: "",
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
    },
    team: {
      members: [{ ...emptyTeamMember(), name: defaults.facultyName ?? "", role: "Principal Investigator" }],
      departmentsInvolved: [],
      externalExpertInvolved: false,
      externalExpertDetails: "",
      rolesAndResponsibilities: "",
    },
    financial: {
      totalValue: "",
      currencyCode: "INR",
      taxApplicable: false,
      taxDetails: "",
      estimatedInstitutionalCosts: "",
      otherApprovedCosts: "",
    },
    scope: {
      scopeOfWork: "",
      expectedOutcomes: "",
      clientAcceptanceRequired: false,
      deliverables: [emptyDeliverable()],
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
    },
  };
}
