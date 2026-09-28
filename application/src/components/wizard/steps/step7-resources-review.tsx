"use client";

import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { ChecklistDocumentUploader, type ChecklistItem } from "@/components/documents/checklist-document-uploader";
import { AGREEMENT_SIGNED_OPTIONS, DECLARATION_ITEMS, IP_EXPECTED_OPTIONS } from "@/lib/validation/consultancy";
import { computeFinancialCalculations, durationInDays, emptyResourceItem, resourceCostTotal, revenueDistributionLines } from "@/lib/wizard/types";
import { RevenueStatement } from "@/components/records/record-view";
import { formatInr } from "@/lib/format";
import { CheckboxGroup, Field, RepeatingHeader, RepeatingRow, SectionHeading } from "../field";
import { patchRow, type StepProps } from "../wizard-props";

type Option = { code: string; label: string };

/** A master-data label — or, for an "Other" choice, the text the user typed. */
function labelOf(options: readonly Option[] | undefined, code: string, otherText?: string): string {
  if (code === "other" && otherText) return otherText;
  return options?.find((o) => o.code === code)?.label ?? code;
}

function labelsOf(options: readonly Option[] | undefined, codes: string[], otherText?: string): string {
  return codes.map((c) => labelOf(options, c, otherText)).join(", ");
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
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${title}`}>
            <Pencil className="h-4 w-4 mr-1" aria-hidden />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const SIGNED_AGREEMENT_CATEGORY = "Signed Agreement";

function documentChecklist(state: StepProps["state"]): ChecklistItem[] {
  const r = state.resources;
  return [
    { category: SIGNED_AGREEMENT_CATEGORY, label: "Signed MoU / Consultancy Agreement / Work Order", requirement: "Mandatory", required: true, show: true },
    { category: "Scope of Work", label: "Scope of Work / Terms of Reference", requirement: "Mandatory if separate", show: true },
    { category: "Client Letter", label: "Client Request / Engagement Letter", requirement: "Mandatory if applicable", show: true },
    { category: "NDA", label: "NDA Document", requirement: "Confidentiality applies", show: r.confidentialInformation && r.ndaAvailable === "yes" },
    { category: "IP Agreement", label: "IP Agreement Document", requirement: "IP is involved", show: r.ipExpected === "yes" },
    { category: "Resource Approval", label: "Resource Approval Document", requirement: "If separate resource approval required", show: r.caiasResourcesRequired },
    {
      category: "External Expert Document",
      label: "External Expert Supporting Document",
      requirement: "External expert involved",
      show: state.team.externalExpertInvolved,
    },
    { category: "Technical Proposal", label: "Technical Proposal", requirement: "If applicable", show: true },
    { category: "Financial Proposal", label: "Financial Proposal", requirement: "If applicable", show: true },
  ]
    .filter((d) => d.show)
    .map(({ show: _show, ...item }) => item);
}

export function Step7ResourcesReview({
  state,
  errors,
  masterData,
  departments,
  staff,
  principal,
  updateResources,
  updateDeclaration,
  draftId,
  ensureDraftSaved,
  signedAgreementUploaded,
  onSignedAgreementChange,
  onEditStep,
  submitError,
}: StepProps & {
  draftId: string | null;
  ensureDraftSaved: () => Promise<string | null>;
  signedAgreementUploaded: boolean;
  onSignedAgreementChange: (uploaded: boolean) => void;
  onEditStep: (step: number) => void;
  submitError: string | null;
}) {
  const { consultancy: c, client, agreement: a, team: t, financial: f, scope: s, timeline, resources: r, declaration } = state;
  const md = masterData;
  const items = r.resourceItems;
  const departmentName = departments.find((d) => d.id === c.departmentId)?.name ?? "";
  const coordinator = staff.find((u) => u.id === c.departmentCoordinatorId)?.name ?? "";
  const duration = durationInDays(c.startDate, c.expectedCompletionDate);
  const shares = computeFinancialCalculations(f.totalValue, f.taxApplicable, f.taxRatePercent || "18", String(resourceCostTotal(r)));

  return (
    <div className="flex flex-col gap-8">
      {/* SECTION A: Institutional Resources */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Institutional Resources & Infrastructure</SectionHeading>
        <div className="flex flex-col gap-1.5">
          <Label>
            Will CAIAS institutional resources be used?<span className="text-status-danger-fg"> *</span>
          </Label>
          <YesNoToggle
            name="Will CAIAS resources be used?"
            value={r.caiasResourcesRequired}
            onChange={(v) =>
              updateResources({ caiasResourcesRequired: v, resourceItems: v && items.length === 0 ? [emptyResourceItem()] : items })
            }
          />
        </div>
        {r.caiasResourcesRequired && (
          <>
            <Field label="Resources Required" required error={errors.resourceTypeCodes}>
              <CheckboxGroup
                idPrefix="resource-type"
                label="Resources Required"
                options={masterData.resource_type ?? []}
                value={r.resourceTypeCodes}
                onChange={(v) => updateResources({ resourceTypeCodes: v })}
              />
            </Field>
            {r.resourceTypeCodes.includes("other") && (
              <Field label="Specify Other Resource" htmlFor="resource-type-other" required error={errors.resourceTypeOther}>
                <Input
                  id="resource-type-other"
                  value={r.resourceTypeOther}
                  onChange={(e) => updateResources({ resourceTypeOther: e.target.value })}
                  placeholder="Type the resource"
                />
              </Field>
            )}
            <RepeatingHeader
              title="Resource Details"
              addLabel="Add Resource Detail"
              onAdd={() => updateResources({ resourceItems: [...items, emptyResourceItem()] })}
              error={errors.resourceItems}
            />
            {items.map((item, i) => (
              <RepeatingRow
                key={i}
                title={`Resource ${i + 1}`}
                removeLabel={`Remove resource ${i + 1}`}
                canRemove={items.length > 1}
                onRemove={() => updateResources({ resourceItems: items.filter((_, j) => j !== i) })}
              >
                <Field label="Resource Name" htmlFor={`res-name-${i}`} required error={errors[`resourceItems.${i}.resource`]}>
                  <Input
                    id={`res-name-${i}`}
                    value={item.resource}
                    onChange={(e) => updateResources({ resourceItems: patchRow(items, i, { resource: e.target.value }) })}
                    placeholder="e.g. Materials Testing Lab"
                  />
                </Field>
                <Field label="Purpose" htmlFor={`res-purpose-${i}`} required error={errors[`resourceItems.${i}.purpose`]}>
                  <Input
                    id={`res-purpose-${i}`}
                    value={item.purpose}
                    onChange={(e) => updateResources({ resourceItems: patchRow(items, i, { purpose: e.target.value }) })}
                  />
                </Field>
                <Field label="Estimated Usage" htmlFor={`res-usage-${i}`}>
                  <Input
                    id={`res-usage-${i}`}
                    value={item.estimatedUsage}
                    onChange={(e) => updateResources({ resourceItems: patchRow(items, i, { estimatedUsage: e.target.value }) })}
                    placeholder="e.g. 40 hours"
                  />
                </Field>
                <Field label="Department / Facility" htmlFor={`res-facility-${i}`}>
                  <Input
                    id={`res-facility-${i}`}
                    value={item.facility}
                    onChange={(e) => updateResources({ resourceItems: patchRow(items, i, { facility: e.target.value }) })}
                  />
                </Field>
                <Field label="Estimated Cost (₹)" htmlFor={`res-cost-${i}`} error={errors[`resourceItems.${i}.cost`]}>
                  <Input
                    id={`res-cost-${i}`}
                    type="number"
                    min="0"
                    value={item.cost}
                    onChange={(e) => updateResources({ resourceItems: patchRow(items, i, { cost: e.target.value }) })}
                    placeholder="e.g. 10000"
                  />
                </Field>
              </RepeatingRow>
            ))}
            <p className="text-sm text-muted-foreground">
              Total Estimated Resource Cost: <strong className="text-foreground">{formatInr(resourceCostTotal(r))}</strong>
            </p>
          </>
        )}
      </section>

      {/* SECTION B: IP & Confidentiality */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Intellectual Property & Confidentiality</SectionHeading>
        <Field label="Is IP expected to be generated?" required error={errors.ipExpected}>
          <SegmentedChoice
            label="Is IP expected to be generated?"
            options={IP_EXPECTED_OPTIONS}
            value={r.ipExpected}
            onChange={(v) => updateResources({ ipExpected: v })}
          />
        </Field>
        {r.ipExpected === "yes" && (
          <>
            <Field label="Type of IP" required error={errors.ipTypeCodes}>
              <CheckboxGroup
                idPrefix="ip-type"
                label="Type of IP"
                options={masterData.ip_type ?? []}
                value={r.ipTypeCodes}
                onChange={(v) => updateResources({ ipTypeCodes: v })}
              />
            </Field>
            {r.ipTypeCodes.includes("other") && (
              <Field label="Specify Other Type of IP" htmlFor="ip-type-other" required error={errors.ipTypeOther}>
                <Input
                  id="ip-type-other"
                  value={r.ipTypeOther}
                  onChange={(e) => updateResources({ ipTypeOther: e.target.value })}
                  placeholder="Type the IP type"
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ownership" htmlFor="ip-ownership" required error={errors.ipOwnership}>
                <Input
                  id="ip-ownership"
                  value={r.ipOwnership}
                  onChange={(e) => updateResources({ ipOwnership: e.target.value })}
                  placeholder="e.g. Jointly owned by CAIAS and client"
                />
              </Field>
              <Field label="Commercialisation Rights" htmlFor="ip-commercial" required error={errors.ipCommercialisationRights}>
                <Input id="ip-commercial" value={r.ipCommercialisationRights} onChange={(e) => updateResources({ ipCommercialisationRights: e.target.value })} />
              </Field>
              <Field label="Registration Responsibility" htmlFor="ip-registration" required error={errors.ipRegistrationResponsibility}>
                <Input
                  id="ip-registration"
                  value={r.ipRegistrationResponsibility}
                  onChange={(e) => updateResources({ ipRegistrationResponsibility: e.target.value })}
                />
              </Field>
              <Field label="Clause Reference" htmlFor="ip-clause">
                <Input id="ip-clause" value={r.ipClauseReference} onChange={(e) => updateResources({ ipClauseReference: e.target.value })} />
              </Field>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5 pt-2">
          <Label>
            Does the consultancy involve confidential information?<span className="text-status-danger-fg"> *</span>
          </Label>
          <YesNoToggle
            name="Does the consultancy involve confidential information?"
            value={r.confidentialInformation}
            onChange={(v) => updateResources({ confidentialInformation: v })}
          />
        </div>
        {r.confidentialInformation && (
          <>
            <Field label="NDA available?" required error={errors.ndaAvailable}>
              <SegmentedChoice
                label="NDA available?"
                options={[
                  { code: "yes", label: "Yes" },
                  { code: "no", label: "No" },
                ]}
                value={r.ndaAvailable}
                onChange={(v) => updateResources({ ndaAvailable: v as "yes" | "no" })}
              />
            </Field>
            {r.ndaAvailable === "no" && (
              <Field label="Confidentiality Justification" htmlFor="conf-justification" required error={errors.confidentialityJustification}>
                <Textarea
                  id="conf-justification"
                  value={r.confidentialityJustification}
                  onChange={(e) => updateResources({ confidentialityJustification: e.target.value })}
                  placeholder="e.g. Confidentiality covered under Clause 7 of signed agreement"
                />
              </Field>
            )}
          </>
        )}
      </section>

      {/* SECTION C: Mandatory Document Repository */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Document Upload Checklist</SectionHeading>
        <p className="text-xs text-muted-foreground">
          Choose the document type, pick one file and upload — repeat for each document. Anything not in the list can be uploaded under
          &quot;Other&quot; with its own name. <strong>Signed Agreement is strictly mandatory</strong> before registration submission.
        </p>
        <ChecklistDocumentUploader
          consultancyId={draftId}
          ensureConsultancyId={ensureDraftSaved}
          items={documentChecklist(state)}
          onCategoryUploadedChange={(uploaded) => onSignedAgreementChange(uploaded.has(SIGNED_AGREEMENT_CATEGORY))}
        />
        {!signedAgreementUploaded && <p className="text-xs font-semibold text-status-danger-fg">Signed agreement document is required before final submission.</p>}
      </section>

      {/* SECTION D: Application Review Summary */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Application Review Summary</SectionHeading>

        <ReviewCard title="1. Institutional & Preliminary Details" onEdit={() => onEditStep(0)}>
          <dl>
            <ReviewRow label="Agreement Signed Status" value={labelOf(AGREEMENT_SIGNED_OPTIONS, c.agreementSignedStatus)} />
            <ReviewRow label="Academic Year" value={c.academicYearCode} />
            <ReviewRow label="Department" value={departmentName} />
            <ReviewRow label="Department Coordinator" value={coordinator} />
            <ReviewRow label="Faculty Consultant" value={principal.name} />
          </dl>
        </ReviewCard>

        <ReviewCard title="2. Client Details" onEdit={() => onEditStep(1)}>
          <dl>
            <ReviewRow label="Organisation" value={client.organizationName} />
            <ReviewRow label="Client Type" value={client.organizationTypeCode === "other" ? client.organizationTypeOther : labelOf(md.organization_type, client.organizationTypeCode)} />
            <ReviewRow label="Industry / Sector" value={client.industrySectorCode} />
            <ReviewRow label="Address" value={[client.address, client.cityCode, client.stateCode, client.countryCode, client.pinCode].filter(Boolean).join(", ")} />
            <ReviewRow label="Authorised Contact" value={`${client.contactPersonName} (${client.designation})`} />
            <ReviewRow label="Contact Info" value={`${client.contactEmail} · ${client.contactPhone}`} />
          </dl>
        </ReviewCard>

        <ReviewCard title="3. Consultancy Details & Scope" onEdit={() => onEditStep(2)}>
          <dl>
            <ReviewRow label="Title" value={c.title} />
            <ReviewRow label="Nature" value={c.natureOfConsultancyCode === "other" ? c.natureOfConsultancyOther : labelOf(md.nature_of_consultancy, c.natureOfConsultancyCode)} />
            <ReviewRow label="Category" value={labelOf(md.consultancy_category, c.consultancyCategoryCode)} />
            <ReviewRow label="Discipline / Domain" value={labelsOf(md.consultancy_domain, c.consultancyDomainCodes, c.consultancyDomainOther)} />
          </dl>
        </ReviewCard>

        <ReviewCard title="4. Agreement & Team" onEdit={() => onEditStep(3)}>
          <dl>
            <ReviewRow label="Agreement Type" value={labelOf(md.agreement_type, a.agreementTypeCode)} />
            <ReviewRow label="Reference Number" value={a.agreementNumber} />
            <ReviewRow label="Team Members" value={t.members.map((m) => `${m.name} (${labelOf(md.team_role, m.role, m.roleOther)})`).join(", ")} />
          </dl>
        </ReviewCard>

        <ReviewCard title="5. Timeline & Milestones" onEdit={() => onEditStep(4)}>
          <dl>
            <ReviewRow label="Start — Completion" value={`${c.startDate} → ${c.expectedCompletionDate} (${duration ?? 0} days)`} />
            <ReviewRow label="Milestones Count" value={`${timeline.milestones.length} milestone(s)`} />
          </dl>
        </ReviewCard>

        <ReviewCard title="6. Financial Details & Allocation" onEdit={() => onEditStep(5)}>
          <dl>
            <ReviewRow label="Total Consultancy Value" value={formatInr(Number(f.totalValue))} />
            <ReviewRow label="Gross Total (inc Tax)" value={f.taxApplicable ? formatInr(Number(shares.grossTotalValue)) : "N/A"} />
          </dl>
          {Number(f.totalValue) > 0 && (
            <div className="mt-3">
              <RevenueStatement head={["Revenue Distribution", "Amount"]} rows={revenueDistributionLines(shares, f.totalValue, formatInr)} />
            </div>
          )}
        </ReviewCard>
      </section>

      {/* SECTION E: Department Declaration */}
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <SectionHeading>Institutional Compliance Declaration</SectionHeading>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Department Declaration</legend>
          {DECLARATION_ITEMS.map((item) => (
            <label key={item.key} htmlFor={`declaration-${item.key}`} className="flex items-start gap-3 py-1.5 text-sm text-foreground">
              <Checkbox
                id={`declaration-${item.key}`}
                className="mt-0.5"
                checked={declaration[item.key]}
                onCheckedChange={(checked) => updateDeclaration({ [item.key]: checked === true })}
              />
              <span>
                {item.text}
                {errors[item.key] && <span className="block text-xs font-semibold text-status-danger-fg">{errors[item.key]}</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="mt-2 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
          Declarer: <strong>{principal.name} ({principal.employeeId})</strong> · Date: <strong>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</strong>
        </div>
      </section>

      {submitError && (
        <div role="alert" className="rounded-lg border border-status-danger-fg/30 bg-status-danger-bg p-4 text-sm text-status-danger-fg">
          {submitError}
        </div>
      )}
    </div>
  );
}
