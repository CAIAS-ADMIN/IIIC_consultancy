"use client";

import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentCategoryPanel } from "@/components/documents/document-category-panel";
import { AGREEMENT_SIGNED_OPTIONS, DECLARATION_ITEMS, IP_EXPECTED_OPTIONS } from "@/lib/validation/consultancy";
import { durationInDays } from "@/lib/wizard/types";
import { formatInr } from "@/lib/format";
import type { StepProps } from "../wizard-props";

type Option = { code: string; label: string };

function labelOf(options: readonly Option[] | undefined, code: string): string {
  return options?.find((o) => o.code === code)?.label ?? code;
}

function labelsOf(options: readonly Option[] | undefined, codes: string[]): string {
  return codes.map((c) => labelOf(options, c)).join(", ");
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 text-sm sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground sm:text-right">{value || "—"}</dd>
    </div>
  );
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${title}`}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Screen 13 document checklist: which upload slots appear, and which are required, for this registration's answers. */
function documentChecklist(state: StepProps["state"]) {
  const r = state.resources;
  return [
    { category: "Signed Agreement", label: "Signed MoU / Consultancy Agreement / Work Order", requirement: "Mandatory", show: true },
    { category: "Scope of Work", label: "Scope of Work / Terms of Reference", requirement: "Mandatory if separate", show: true },
    { category: "Client Letter", label: "Client Request / Engagement Letter", requirement: "Mandatory if applicable", show: true },
    { category: "NDA", label: "NDA", requirement: "Confidentiality applies", show: r.confidentialInformation && r.ndaAvailable === "yes" },
    { category: "IP Agreement", label: "IP Agreement", requirement: "IP is involved", show: r.ipExpected === "yes" },
    { category: "Resource Approval", label: "Resource Approval", requirement: "If resources need separate approval", show: r.caiasResourcesRequired },
    {
      category: "External Expert Document",
      label: "External Expert Supporting Document",
      requirement: "External expert involved",
      show: state.team.externalExpertInvolved,
    },
    { category: "Technical Proposal", label: "Technical Proposal", requirement: "If applicable", show: true },
    { category: "Financial Proposal", label: "Financial Proposal", requirement: "If applicable", show: true },
    { category: "Other Supporting Document", label: "Other Supporting Document", requirement: "Optional", show: true },
  ].filter((d) => d.show);
}

export function Step5Review({
  state,
  errors,
  masterData,
  departments,
  staff,
  principal,
  updateDeclaration,
  draftId,
  signedAgreementUploaded,
  onSignedAgreementChange,
  onEditStep,
  submitError,
}: StepProps & {
  draftId: string | null;
  signedAgreementUploaded: boolean;
  onSignedAgreementChange: (uploaded: boolean) => void;
  onEditStep: (step: number) => void;
  submitError: string | null;
}) {
  const { consultancy: c, client, agreement: a, team: t, financial: f, scope: s, timeline, resources: r, declaration } = state;
  const md = masterData;
  const departmentName = departments.find((d) => d.id === c.departmentId)?.name ?? "";
  const coordinator = staff.find((u) => u.id === c.departmentCoordinatorId)?.name ?? "";
  const duration = durationInDays(c.startDate, c.expectedCompletionDate);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">Check everything below. Use Edit to change a section — nothing is submitted until you press Submit.</p>

      <ReviewCard title="Department Details" onEdit={() => onEditStep(1)}>
        <dl>
          <ReviewRow label="Agreement Signed" value={labelOf(AGREEMENT_SIGNED_OPTIONS, c.agreementSignedStatus)} />
          <ReviewRow label="Academic Year" value={c.academicYearCode} />
          <ReviewRow label="Department" value={departmentName} />
          <ReviewRow label="Department Consultancy Coordinator" value={coordinator} />
          <ReviewRow label="Faculty Consultant" value={principal.name} />
          <ReviewRow label="Employee ID" value={principal.employeeId} />
        </dl>
      </ReviewCard>

      <ReviewCard title="Client Details" onEdit={() => onEditStep(0)}>
        <dl>
          <ReviewRow label="Organisation" value={client.organizationName} />
          <ReviewRow
            label="Client Type"
            value={client.organizationTypeCode === "other" ? client.organizationTypeOther : labelOf(md.organization_type, client.organizationTypeCode)}
          />
          <ReviewRow label="Industry / Sector" value={client.industrySectorCode} />
          <ReviewRow
            label="Address"
            value={[client.address, client.cityCode, client.stateCode, client.countryCode, client.pinCode].filter(Boolean).join(", ")}
          />
          <ReviewRow label="GST / PAN" value={[client.gstin, client.pan].filter(Boolean).join(" · ")} />
          <ReviewRow label="Authorised Contact" value={[client.contactPersonName, client.designation].filter(Boolean).join(", ")} />
          <ReviewRow label="Email / Mobile" value={[client.contactEmail, client.contactPhone].filter(Boolean).join(" · ")} />
          {client.alternateContactName && <ReviewRow label="Alternate Contact" value={client.alternateContactName} />}
        </dl>
      </ReviewCard>

      <ReviewCard title="Consultancy Details" onEdit={() => onEditStep(1)}>
        <dl>
          <ReviewRow label="Title" value={c.title} />
          <ReviewRow
            label="Nature of Consultancy"
            value={c.natureOfConsultancyCode === "other" ? c.natureOfConsultancyOther : labelOf(md.nature_of_consultancy, c.natureOfConsultancyCode)}
          />
          <ReviewRow label="Consultancy Domain" value={labelsOf(md.consultancy_domain, c.consultancyDomainCodes)} />
          <ReviewRow label="Consultancy Category" value={labelOf(md.consultancy_category, c.consultancyCategoryCode)} />
          <ReviewRow label="Consultancy Type" value={labelOf(md.consultancy_type, c.consultancyTypeCode)} />
          <ReviewRow
            label="Consultancy Area"
            value={c.consultancyAreaCode === "other" ? c.consultancyAreaOther : labelOf(md.consultancy_area, c.consultancyAreaCode)}
          />
        </dl>
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {[
            ["Problem / Requirement of Client", c.clientProblem],
            ["Objective", c.objective],
            ["Scope of Work", s.scopeOfWork],
            ["Expected Outcomes", s.expectedOutcomes],
          ].map(([heading, text]) => (
            <div key={heading}>
              <p className="font-medium text-foreground">{heading}</p>
              <p className="whitespace-pre-line text-muted-foreground">{text || "—"}</p>
            </div>
          ))}
          <div>
            <p className="font-medium text-foreground">Key Deliverables</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {s.deliverables
                .filter((d) => d.name.trim() !== "")
                .map((d, i) => (
                  <li key={i}>
                    {d.name}
                    {d.dueDate && ` — by ${d.dueDate}`}
                    {d.responsibleConsultant && ` (${d.responsibleConsultant})`}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </ReviewCard>

      <ReviewCard title="Agreement" onEdit={() => onEditStep(2)}>
        <dl>
          <ReviewRow label="Agreement Type" value={a.agreementTypeCode === "other" ? a.agreementTypeOther : labelOf(md.agreement_type, a.agreementTypeCode)} />
          <ReviewRow label="Reference" value={a.agreementNumber} />
          <ReviewRow label="Agreement Date" value={a.agreementDate} />
          <ReviewRow label="Start – End" value={[a.agreementStartDate, a.agreementEndDate].filter(Boolean).join(" – ")} />
          <ReviewRow label="Renewal / Extension Clause" value={a.renewalClause} />
          <ReviewRow
            label="Clauses"
            value={[a.confidentialityClause && "Confidentiality", a.ipClause && "IP", a.paymentTermsIncluded && "Payment terms"].filter(Boolean).join(", ") || "None"}
          />
        </dl>
      </ReviewCard>

      <ReviewCard title="Consultancy Team" onEdit={() => onEditStep(2)}>
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          {t.members
            .filter((m) => m.name.trim() !== "")
            .map((m, i) => (
              <li key={i}>
                <span className="font-medium">{m.name}</span> — {labelOf(md.team_role, m.role)}
                <span className="text-muted-foreground">
                  {[m.department, m.designation, m.contributionPercent && `${m.contributionPercent}%`].filter(Boolean).map((x) => ` · ${x}`)}
                </span>
              </li>
            ))}
        </ul>
        {t.externalExpertInvolved && (
          <p className="mt-2 text-sm text-muted-foreground">
            External experts: {t.externalExperts.map((e) => `${e.name} (${e.organisation})`).join(", ") || "—"}
          </p>
        )}
      </ReviewCard>

      <ReviewCard title="Timeline" onEdit={() => onEditStep(1)}>
        <dl>
          <ReviewRow label="Start Date" value={c.startDate} />
          <ReviewRow label="Expected Completion" value={c.expectedCompletionDate} />
          <ReviewRow label="Duration" value={duration === null ? "" : `${duration} days`} />
          <ReviewRow
            label="Reporting Frequency"
            value={c.reportingFrequency === "custom" ? c.reportingFrequencyOther : labelOf(md.reporting_frequency, c.reportingFrequency)}
          />
        </dl>
        {timeline.milestones.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {timeline.milestones.map((m, i) => (
              <li key={i}>
                {m.title}: {m.startDate} → {m.plannedDate} ({m.responsiblePerson})
              </li>
            ))}
          </ul>
        )}
      </ReviewCard>

      <ReviewCard title="Financial Details" onEdit={() => onEditStep(2)}>
        <dl>
          <ReviewRow label="Total Consultancy Value" value={f.totalValue ? formatInr(Number(f.totalValue)) : ""} />
          <ReviewRow label="Payment Structure" value={a.paymentTermsCode === "other" ? a.paymentTermsOther : labelOf(md.payment_terms, a.paymentTermsCode)} />
          {f.paymentSchedule
            .filter((p) => p.stageLabel.trim() !== "")
            .map((p, i) => (
              <ReviewRow key={i} label={p.stageLabel} value={`${formatInr(Number(p.plannedAmount) || 0)} — due ${p.plannedDate || "—"}`} />
            ))}
        </dl>
      </ReviewCard>

      <ReviewCard title="Resources" onEdit={() => onEditStep(3)}>
        <dl>
          <ReviewRow label="CAIAS Resources Used" value={r.caiasResourcesRequired ? "Yes" : "No"} />
          {r.caiasResourcesRequired && <ReviewRow label="Resources" value={labelsOf(md.resource_type, r.resourceTypeCodes)} />}
          {r.caiasResourcesRequired &&
            r.resourceItems.map((item, i) => <ReviewRow key={i} label={item.resource || `Resource ${i + 1}`} value={item.purpose} />)}
        </dl>
      </ReviewCard>

      <ReviewCard title="IP & Confidentiality" onEdit={() => onEditStep(3)}>
        <dl>
          <ReviewRow label="IP Expected" value={labelOf(IP_EXPECTED_OPTIONS, r.ipExpected)} />
          {r.ipExpected === "yes" && (
            <>
              <ReviewRow label="Type of IP" value={labelsOf(md.ip_type, r.ipTypeCodes)} />
              <ReviewRow label="Ownership" value={r.ipOwnership} />
              <ReviewRow label="Commercialisation Rights" value={r.ipCommercialisationRights} />
              <ReviewRow label="Registration Responsibility" value={r.ipRegistrationResponsibility} />
            </>
          )}
          <ReviewRow label="Confidential Information" value={r.confidentialInformation ? "Yes" : "No"} />
          {r.confidentialInformation && <ReviewRow label="NDA Available" value={r.ndaAvailable === "yes" ? "Yes" : r.ndaAvailable === "no" ? "No" : ""} />}
        </dl>
      </ReviewCard>

      <ReviewCard title="Documents">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            PDF preferred. The signed agreement must be uploaded before you can submit; upload annexures as further versions of the same slot.
          </p>
          {documentChecklist(state).map((doc) => (
            <div key={doc.category} className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{doc.requirement}</p>
              <DocumentCategoryPanel
                consultancyId={draftId}
                category={doc.category}
                label={doc.label}
                required={doc.category === "Signed Agreement"}
                onUploadedChange={doc.category === "Signed Agreement" ? onSignedAgreementChange : undefined}
              />
            </div>
          ))}
          {!signedAgreementUploaded && <p className="text-xs text-status-warning-fg">Signed agreement not uploaded yet.</p>}
        </div>
      </ReviewCard>

      <ReviewCard title="Declaration">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Department Declaration</legend>
          {DECLARATION_ITEMS.map((item) => (
            <label key={item.key} htmlFor={`declaration-${item.key}`} className="flex items-start gap-3 py-1 text-sm text-foreground">
              <Checkbox
                id={`declaration-${item.key}`}
                className="mt-0.5"
                checked={declaration[item.key]}
                onCheckedChange={(checked) => updateDeclaration({ [item.key]: checked === true })}
              />
              <span>
                {item.text}
                {errors[item.key] && <span className="block text-status-danger-fg">{errors[item.key]}</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <dl className="mt-3 border-t border-border pt-3">
          <ReviewRow label="Declaration by" value={`${principal.name}${principal.employeeId ? ` (${principal.employeeId})` : ""}`} />
          <ReviewRow label="Department" value={departmentName} />
          <ReviewRow label="Date" value={new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} />
        </dl>
      </ReviewCard>

      {submitError && (
        <div role="alert" className="rounded-lg border border-status-danger-bg bg-status-danger-bg/40 p-4 text-sm text-status-danger-fg">
          {submitError}
        </div>
      )}
    </div>
  );
}
