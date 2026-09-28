import { AGREEMENT_SIGNED_OPTIONS, DECLARATION_ITEMS, IP_EXPECTED_OPTIONS } from "@/lib/validation/consultancy";
import { computeFinancialCalculations, durationInDays, resourceCostTotal, revenueDistributionLines } from "@/lib/wizard/types";
import { formatInr } from "@/lib/format";
import type { RegistrationRecord } from "@/db/queries/registration-record";
import type { Cell, RecordBlock, RecordSection } from "./model";

type Option = { code: string; label: string };

/** A master-data label — or, for an "Other" choice, the text the user typed. */
export function labelOf(options: readonly Option[] | undefined, code: string | null | undefined, otherText?: string | null): string {
  if (!code) return "";
  if (code === "other" && otherText) return otherText;
  return options?.find((o) => o.code === code)?.label ?? code;
}

export function labelsOf(options: readonly Option[] | undefined, codes: string[] | null | undefined, otherText?: string | null): string {
  return (codes ?? []).map((c) => labelOf(options, c, otherText)).join(", ");
}

export function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value ? "Yes" : "No";
}

export function money(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "" : formatInr(Number(value));
}

const humanize = (value: string) => value.replace(/_/g, " ");

/**
 * The registration as captured by the wizard (portal spec Screens 3–14),
 * grouped the way the spec's Review screen and PDF 1 list it.
 */
export function registrationSections(
  record: RegistrationRecord,
  options: { showDeclaration?: boolean; includeSignoff?: boolean } = {}
): RecordSection[] {
  const { consultancy: c, client, agreement: a, masterData: md } = record;
  const duration = durationInDays(c.startDate ?? "", c.originalCompletionDate ?? "");
  // Other Approved Costs = the CAIAS resources used (stored, or worked out from the resource list for older records).
  const resourceCost = c.otherApprovedCosts !== null && c.otherApprovedCosts !== undefined ? Number(c.otherApprovedCosts) : resourceCostTotal(c);
  const split = c.totalValue ? computeFinancialCalculations(c.totalValue, false, "0", String(resourceCost)) : null;

  const sections: RecordSection[] = [
    {
      title: "Department Details",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Academic Year", c.academicYearCode],
            ["Department", record.departmentName],
            ["Other Departments Involved", record.departmentsInvolved.join(", ")],
            ["Department Consultancy Coordinator", record.coordinator?.name],
            ["Faculty Consultant", record.facultyInCharge?.name],
            ["Employee ID", record.facultyInCharge?.employeeId],
            ["Agreement Signed", labelOf(AGREEMENT_SIGNED_OPTIONS, c.agreementSignedStatus)],
            ["Registration Date", c.submittedAt ? new Date(c.submittedAt).toLocaleString("en-IN") : ""],
          ],
        },
      ],
    },
    {
      title: "Client Details",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Organisation", client?.organizationName],
            ["Client Type", client?.organizationTypeCode === "other" ? client?.organizationTypeOther : labelOf(md.organization_type, client?.organizationTypeCode)],
            ["Industry / Sector", client?.industrySectorCode],
            ["Registered Address", [client?.address, client?.cityCode, client?.stateCode, client?.countryCode, client?.pinCode].filter(Boolean).join(", ")],
            ["Website", client?.website],
            ["GST Number", client?.gstin],
            ["PAN / Registration No.", client?.pan],
            ["Authorised Contact", [client?.contactPersonName, client?.designation, client?.contactDepartment].filter(Boolean).join(", ")],
            ["Official Email", client?.contactEmail],
            ["Mobile Number", client?.contactPhone],
            ["Alternate Contact", [client?.alternateContactName, client?.alternateContactEmail, client?.alternateContactPhone].filter(Boolean).join(" · ")],
          ],
        },
      ],
    },
    {
      title: "Consultancy Details",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Nature of Consultancy", c.natureOfConsultancyCode === "other" ? c.natureOfConsultancyOther : labelOf(md.nature_of_consultancy, c.natureOfConsultancyCode)],
            ["Consultancy Domain", labelsOf(md.consultancy_domain, c.consultancyDomainCodes, c.consultancyDomainOther)],
            ["Consultancy Category", labelOf(md.consultancy_category, c.consultancyCategoryCode)],
            ["Consultancy Type", labelOf(md.consultancy_type, c.consultancyTypeCode, c.consultancyTypeOther)],
            ["Team Type", labelOf(md.team_type, c.teamTypeCode)],
            ["Consultancy Area", c.consultancyAreaCode === "other" ? c.consultancyAreaOther : labelOf(md.consultancy_area, c.consultancyAreaCode)],
          ],
        },
        { kind: "text", label: "Problem / Requirement of Client", text: c.clientProblem },
        { kind: "text", label: "Objective of Consultancy", text: c.objective },
        { kind: "text", label: "Scope of Work", text: c.scopeOfWork },
        { kind: "text", label: "Expected Outcomes", text: c.expectedOutcomes },
        ...(c.description ? [{ kind: "text", label: "Additional Notes", text: c.description } as RecordBlock] : []),
      ],
    },
    {
      title: "Key Deliverables",
      blocks: [
        {
          kind: "table",
          head: ["Deliverable", "Description", "Expected Date", "Responsible", "Status"],
          rows: record.deliverables.map((d) => [d.name ?? d.description, d.name ? d.description : "", d.dueDate, d.responsibleConsultant, humanize(d.status)]),
        },
      ],
    },
    {
      title: "Agreement",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Agreement Type", a?.agreementTypeCode === "other" ? a?.agreementTypeOther : labelOf(md.agreement_type, a?.agreementTypeCode)],
            ["Agreement Number / Reference", a?.agreementNumber],
            ["Agreement Date", a?.agreementDate],
            ["Start – End", [a?.agreementStartDate, a?.agreementEndDate].filter(Boolean).join(" – ")],
            ["Renewal / Extension Clause", a?.renewalClause],
            ["Confidentiality Clause", yesNo(a?.confidentialityClause)],
            ["IP Clause", yesNo(a?.ipClause)],
            ["Payment Terms Included", yesNo(a?.paymentTermsIncluded)],
          ],
        },
      ],
    },
    {
      title: "Consultancy Team",
      blocks: [
        {
          kind: "table",
          head: ["Name", "Role", "Employee ID", "Department", "Designation", "Hours", "Contribution"],
          rows: record.team.map((m) => [
            m.name + (m.isExternal ? " (external)" : ""),
            labelOf(md.team_role, m.role, m.roleOther),
            m.employeeId,
            m.department,
            m.designation,
            m.estimatedHours,
            m.contributionPercent ? `${Number(m.contributionPercent)}%` : "",
          ]),
        },
        ...(c.rolesAndResponsibilities ? [{ kind: "text", label: "Roles & Responsibilities", text: c.rolesAndResponsibilities } as RecordBlock] : []),
        ...(c.externalExpertInvolved
          ? [
              {
                kind: "table",
                head: ["External Expert", "Organisation", "Expertise", "Role", "Engagement Terms"],
                rows:
                  c.externalExperts.length > 0
                    ? c.externalExperts.map((e) => [e.name, e.organisation, e.expertise, e.role, e.engagementTerms])
                    : [[c.externalExpertDetails, "", "", "", ""]],
              } as RecordBlock,
            ]
          : []),
      ],
    },
    {
      title: "Timeline",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Start Date", c.startDate],
            ["Expected Completion Date", c.originalCompletionDate],
            ["Current Completion Date", c.currentCompletionDate !== c.originalCompletionDate ? c.currentCompletionDate : ""],
            ["Duration", duration === null ? "" : `${duration} days`],
            ["Reporting Frequency", c.reportingFrequency === "custom" ? c.reportingFrequencyOther : labelOf(md.reporting_frequency, c.reportingFrequency)],
          ],
        },
        {
          kind: "table",
          head: ["Milestone", "Description", "Start", "Expected Completion", "Responsible", "Status"],
          rows: record.milestones.map((m) => [m.title, m.description, m.startDate, m.plannedDate, m.responsiblePerson, humanize(m.status)]),
        },
      ],
    },
    {
      title: "Financial Details",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Total Consultancy Value", money(c.totalValue)],
            ["Currency", labelOf(md.currency, c.currencyCode, c.currencyOther)],
            ["Payment Structure", a?.paymentTermsCode === "other" ? a?.paymentTermsOther : labelOf(md.payment_terms, a?.paymentTermsCode)],
            ["Payment Mode", labelOf(md.payment_mode, a?.paymentModeCode, a?.paymentModeOther)],
            [
              "Tax / GST",
              c.taxApplicable
                ? [c.taxRatePercent && `${Number(c.taxRatePercent)}%`, c.taxAmount && money(c.taxAmount), c.taxDetails].filter(Boolean).join(" · ") || "Applicable"
                : "Not applicable",
            ],
            ...(c.taxApplicable && c.totalValue
              ? ([["Gross Total (Value + Tax)", money(String(Number(c.totalValue) + Number(c.taxAmount ?? 0)))]] as [string, Cell][])
              : []),
          ],
        },
        ...(split && c.totalValue
          ? [
              {
                kind: "statement",
                head: ["Revenue Distribution", "Amount"],
                rows: revenueDistributionLines(split, c.totalValue, formatInr),
              } as RecordBlock,
            ]
          : []),
        {
          kind: "table",
          head: ["Payment Stage", "Amount", "Due Date"],
          rows: record.paymentSchedule.map((p) => [p.stageLabel, money(p.plannedAmount), p.plannedDate]),
        },
        { kind: "note", text: "Payments are routed to the designated CAIAS institutional account." },
      ],
    },
    {
      title: "Institutional Resources",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["CAIAS Resources Used", yesNo(c.caiasResourcesRequired)],
            ["Resources", labelsOf(md.resource_type, c.resourceTypeCodes, c.resourceTypeOther)],
            ["Estimated Resource Cost", money(c.estimatedResourceCost)],
          ],
        },
        ...(c.caiasResourcesRequired
          ? c.resourceItems.length > 0
            ? [
                {
                  kind: "table",
                  head: ["Resource", "Purpose", "Estimated Usage", "Department / Facility", "Cost"],
                  rows: c.resourceItems.map((r) => [r.resource, r.purpose, r.estimatedUsage, r.facility, money(r.cost)]),
                } as RecordBlock,
              ]
            : [{ kind: "text", label: "Resource Details", text: c.resourceDetails } as RecordBlock]
          : []),
      ],
    },
    {
      title: "IP & Confidentiality",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["IP Expected", labelOf(IP_EXPECTED_OPTIONS, c.ipExpected) || yesNo(c.ipAgreementRequired)],
            ...(c.ipExpected === "yes"
              ? ([
                  ["Type of IP", labelsOf(md.ip_type, c.ipTypeCodes, c.ipTypeOther)],
                  ["Ownership", c.ipOwnership],
                  ["Commercialisation Rights", c.ipCommercialisationRights],
                  ["Registration Responsibility", c.ipRegistrationResponsibility],
                  ["Clause / Agreement Reference", c.ipClauseReference],
                ] as [string, Cell][])
              : []),
            ["Confidential Information", yesNo(c.confidentialInformation)],
            ...(c.confidentialInformation
              ? ([
                  ["NDA Available", yesNo(c.ndaAvailable)],
                  ["Confidentiality Arrangement", c.confidentialityJustification],
                ] as [string, Cell][])
              : []),
          ],
        },
      ],
    },
    {
      title: "Document Checklist",
      blocks: [
        {
          kind: "table",
          head: ["Document", "Version", "Uploaded", "Reference"],
          rows: record.documents.map((d) => [
            d.documentCategory,
            `v${d.version}`,
            `${new Date(d.uploadedAt).toLocaleDateString("en-IN")} by ${d.uploadedByName ?? "—"}`,
            d.id.slice(0, 8).toUpperCase(),
          ]),
        },
        { kind: "note", text: "Supporting documents are available in the CAIAS Consultancy Portal (reference shown)." },
      ],
    },
  ];

  if (options.showDeclaration ?? true) {
    sections.push({
      title: "Declaration",
      blocks: c.declarationAcceptedAt
        ? [
            { kind: "list", items: DECLARATION_ITEMS.map((item) => item.text) },
            {
              kind: "fields",
              rows: [
                ["Declared by", [record.declarant?.name, record.declarant?.employeeId].filter(Boolean).join(" — ")],
                ["Department", record.departmentName],
                ["Date", new Date(c.declarationAcceptedAt).toLocaleString("en-IN")],
              ],
            },
          ]
        : [{ kind: "note", text: "Registered before the declaration step was introduced." }],
    });
  }

  // Printed and signed by hand: the faculty coordinator's declaration, then IIIC's registration & verification.
  if (options.includeSignoff ?? true) sections.push(
    {
      title: "Faculty Coordinator / Consultancy Team Declaration",
      blocks: [
        {
          kind: "signoff",
          statement:
            "I/We certify that the information provided in this form is accurate and that the consultancy will be undertaken in accordance with the approved scope, agreement, and applicable CAIAS policies and procedures.",
          lines: [
            [{ label: "Name of Faculty Coordinator", value: record.facultyInCharge?.name }],
            [{ label: "Signature" }, { label: "Date" }],
          ],
        },
      ],
    },
    {
      title: "IIIC Registration and Verification",
      blocks: [
        {
          kind: "signoff",
          lines: [
            [{ label: "Date Received" }],
            [{ label: "Documents Verified" }],
            [{ label: "CAIAS Consultancy ID", value: c.consultancyCode }],
            [{ label: "Verified By" }],
            [{ label: "Designation" }],
            [{ label: "Signature" }, { label: "Date" }],
          ],
        },
      ],
    }
  );

  return sections;
}
