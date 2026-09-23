"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { Field, MasterDataSelect, SectionHeading } from "../field";
import { emptyTeamMember } from "@/lib/wizard/types";
import type { StepProps } from "../wizard-props";

export function Step3TeamAgreement({
  state,
  errors,
  masterData,
  departments,
  updateTeam,
  updateAgreement,
  updateFinancial,
  updateResources,
}: StepProps) {
  const t = state.team;
  const a = state.agreement;
  const f = state.financial;
  const r = state.resources;

  const isAgreementTypeOther = a.agreementTypeCode === "other";
  const isPaymentTermsOther = a.paymentTermsCode === "other";
  const isPaymentModeOther = a.paymentModeCode === "other";

  function updateMember(index: number, patch: Partial<(typeof t.members)[number]>) {
    updateTeam({ members: t.members.map((m, i) => (i === index ? { ...m, ...patch } : m)) });
  }

  function addMember() {
    updateTeam({ members: [...t.members, emptyTeamMember()] });
  }

  function removeMember(index: number) {
    updateTeam({ members: t.members.filter((_, i) => i !== index) });
  }

  function toggleDepartmentInvolved(id: string) {
    const set = new Set(t.departmentsInvolved);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    updateTeam({ departmentsInvolved: [...set] });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionHeading>Team Members</SectionHeading>
          <Button type="button" variant="secondary" size="sm" onClick={addMember}>
            <Plus className="h-4 w-4" aria-hidden />
            Add Member
          </Button>
        </div>
        {errors["members"] && <p className="text-sm text-status-danger-fg">{errors["members"]}</p>}
        <div className="flex flex-col gap-3">
          {t.members.map((m, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-end">
              <Field label="Name" htmlFor={`member-name-${i}`} className="flex-1">
                <Input id={`member-name-${i}`} value={m.name} onChange={(e) => updateMember(i, { name: e.target.value })} />
              </Field>
              <Field label="Role" htmlFor={`member-role-${i}`} className="flex-1">
                <Input
                  id={`member-role-${i}`}
                  value={m.role}
                  onChange={(e) => updateMember(i, { role: e.target.value })}
                  placeholder="e.g. Co-Investigator"
                />
              </Field>
              <Field label="Department" htmlFor={`member-dept-${i}`} className="flex-1">
                <Input
                  id={`member-dept-${i}`}
                  value={m.department}
                  onChange={(e) => updateMember(i, { department: e.target.value })}
                />
              </Field>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id={`member-external-${i}`}
                  checked={m.isExternal}
                  onCheckedChange={(checked) => updateMember(i, { isExternal: checked === true })}
                />
                <Label htmlFor={`member-external-${i}`} className="text-sm font-normal text-muted-foreground">
                  External
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove team member"
                onClick={() => removeMember(i)}
                disabled={t.members.length === 1}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>

        <Field label="Roles &amp; Responsibilities" htmlFor="team-roles" error={errors.rolesAndResponsibilities}>
          <Textarea
            id="team-roles"
            value={t.rolesAndResponsibilities}
            onChange={(e) => updateTeam({ rolesAndResponsibilities: e.target.value })}
          />
        </Field>

        {departments.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Departments Involved</Label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {departments.map((d) => (
                <div key={d.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`dept-involved-${d.id}`}
                    checked={t.departmentsInvolved.includes(d.id)}
                    onCheckedChange={() => toggleDepartmentInvolved(d.id)}
                  />
                  <Label htmlFor={`dept-involved-${d.id}`} className="text-sm font-normal">
                    {d.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>External Expert Involved?</Label>
            <YesNoToggle
              name="externalExpertInvolved"
              value={t.externalExpertInvolved}
              onChange={(v) => updateTeam({ externalExpertInvolved: v })}
            />
          </div>
          {t.externalExpertInvolved && (
            <Field label="External Expert Details" htmlFor="team-external-details" required error={errors.externalExpertDetails}>
              <Input
                id="team-external-details"
                value={t.externalExpertDetails}
                onChange={(e) => updateTeam({ externalExpertDetails: e.target.value })}
              />
            </Field>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading>CAIAS Resources</SectionHeading>
        <div className="flex flex-col gap-1.5">
          <Label>Are CAIAS Resources Required?</Label>
          <YesNoToggle
            name="caiasResourcesRequired"
            value={r.caiasResourcesRequired}
            onChange={(v) => updateResources({ caiasResourcesRequired: v })}
          />
        </div>
        {r.caiasResourcesRequired && (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {(
                [
                  ["laboratoryRequired", "Laboratory"],
                  ["equipmentRequired", "Equipment"],
                  ["softwareRequired", "Software"],
                  ["travelRequired", "Travel"],
                  ["externalExpertRequired", "External Expert"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`resource-${key}`}
                    checked={r[key]}
                    onCheckedChange={(checked) => updateResources({ [key]: checked === true })}
                  />
                  <Label htmlFor={`resource-${key}`} className="text-sm font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
            <Field label="Resource Details" htmlFor="resource-details" required error={errors.resourceDetails}>
              <Textarea
                id="resource-details"
                value={r.resourceDetails}
                onChange={(e) => updateResources({ resourceDetails: e.target.value })}
              />
            </Field>
            <Field label="Estimated Resource Cost" htmlFor="resource-cost" error={errors.estimatedResourceCost}>
              <Input
                id="resource-cost"
                type="number"
                min="0"
                value={r.estimatedResourceCost}
                onChange={(e) => updateResources({ estimatedResourceCost: e.target.value })}
              />
            </Field>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading>Agreement</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Agreement Type" htmlFor="agreement-type" required error={errors.agreementTypeCode}>
            <MasterDataSelect
              id="agreement-type"
              options={masterData.agreement_type ?? []}
              value={a.agreementTypeCode}
              onChange={(v) => updateAgreement({ agreementTypeCode: v })}
              placeholder="Select agreement type"
            />
          </Field>
          {isAgreementTypeOther && (
            <Field label="Specify Agreement Type" htmlFor="agreement-type-other" required error={errors.agreementTypeOther}>
              <Input
                id="agreement-type-other"
                value={a.agreementTypeOther}
                onChange={(e) => updateAgreement({ agreementTypeOther: e.target.value })}
              />
            </Field>
          )}
          <Field label="Agreement Number" htmlFor="agreement-number" error={errors.agreementNumber}>
            <Input
              id="agreement-number"
              value={a.agreementNumber}
              onChange={(e) => updateAgreement({ agreementNumber: e.target.value })}
            />
          </Field>
          <Field label="Agreement Date" htmlFor="agreement-date" error={errors.agreementDate}>
            <Input
              id="agreement-date"
              type="date"
              value={a.agreementDate}
              onChange={(e) => updateAgreement({ agreementDate: e.target.value })}
            />
          </Field>
          <Field label="Agreement Start Date" htmlFor="agreement-start" error={errors.agreementStartDate}>
            <Input
              id="agreement-start"
              type="date"
              value={a.agreementStartDate}
              onChange={(e) => updateAgreement({ agreementStartDate: e.target.value })}
            />
          </Field>
          <Field label="Agreement End Date" htmlFor="agreement-end" error={errors.agreementEndDate}>
            <Input
              id="agreement-end"
              type="date"
              value={a.agreementEndDate}
              onChange={(e) => updateAgreement({ agreementEndDate: e.target.value })}
            />
          </Field>
          <Field label="Agreement Value (₹)" htmlFor="agreement-value" required error={errors.agreementValue}>
            <Input
              id="agreement-value"
              type="number"
              min="0"
              value={a.agreementValue}
              onChange={(e) => updateAgreement({ agreementValue: e.target.value })}
            />
          </Field>
          <Field label="Payment Terms" htmlFor="payment-terms" required error={errors.paymentTermsCode}>
            <MasterDataSelect
              id="payment-terms"
              options={masterData.payment_terms ?? []}
              value={a.paymentTermsCode}
              onChange={(v) => updateAgreement({ paymentTermsCode: v })}
              placeholder="Select payment terms"
            />
          </Field>
          {isPaymentTermsOther && (
            <Field label="Specify Payment Terms" htmlFor="payment-terms-other" required error={errors.paymentTermsOther}>
              <Input
                id="payment-terms-other"
                value={a.paymentTermsOther}
                onChange={(e) => updateAgreement({ paymentTermsOther: e.target.value })}
              />
            </Field>
          )}
          <Field label="Payment Mode" htmlFor="payment-mode" error={errors.paymentModeCode}>
            <MasterDataSelect
              id="payment-mode"
              options={masterData.payment_mode ?? []}
              value={a.paymentModeCode}
              onChange={(v) => updateAgreement({ paymentModeCode: v })}
              placeholder="Select payment mode"
            />
          </Field>
          {isPaymentModeOther && (
            <Field label="Specify Payment Mode" htmlFor="payment-mode-other" required error={errors.paymentModeOther}>
              <Input
                id="payment-mode-other"
                value={a.paymentModeOther}
                onChange={(e) => updateAgreement({ paymentModeOther: e.target.value })}
              />
            </Field>
          )}
          <Field label="Number of Installments" htmlFor="installments" error={errors.numberOfInstallments}>
            <Input
              id="installments"
              type="number"
              min="1"
              step="1"
              value={a.numberOfInstallments}
              onChange={(e) => updateAgreement({ numberOfInstallments: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeading>Financial Details</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total Value (₹)" htmlFor="total-value" required error={errors.totalValue}>
            <Input
              id="total-value"
              type="number"
              min="0"
              value={f.totalValue}
              onChange={(e) => updateFinancial({ totalValue: e.target.value })}
            />
          </Field>
          <Field label="Currency" htmlFor="currency" required error={errors.currencyCode}>
            <MasterDataSelect
              id="currency"
              options={masterData.currency ?? []}
              value={f.currencyCode}
              onChange={(v) => updateFinancial({ currencyCode: v })}
              placeholder="Select currency"
            />
          </Field>
          <Field label="Estimated Institutional Costs (₹)" htmlFor="inst-costs" error={errors.estimatedInstitutionalCosts}>
            <Input
              id="inst-costs"
              type="number"
              min="0"
              value={f.estimatedInstitutionalCosts}
              onChange={(e) => updateFinancial({ estimatedInstitutionalCosts: e.target.value })}
            />
          </Field>
          <Field label="Other Approved Costs (₹)" htmlFor="other-costs" error={errors.otherApprovedCosts}>
            <Input
              id="other-costs"
              type="number"
              min="0"
              value={f.otherApprovedCosts}
              onChange={(e) => updateFinancial({ otherApprovedCosts: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Is Tax Applicable?</Label>
          <YesNoToggle
            name="taxApplicable"
            value={f.taxApplicable}
            onChange={(v) => updateFinancial({ taxApplicable: v })}
          />
        </div>
        {f.taxApplicable && (
          <Field label="Tax Details" htmlFor="tax-details" required error={errors.taxDetails}>
            <Input id="tax-details" value={f.taxDetails} onChange={(e) => updateFinancial({ taxDetails: e.target.value })} />
          </Field>
        )}
      </div>
    </div>
  );
}
