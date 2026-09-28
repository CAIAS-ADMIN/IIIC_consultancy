"use client";

import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { formatInr } from "@/lib/format";
import { emptyExternalExpert, emptyPaymentStage, emptyTeamMember } from "@/lib/wizard/types";
import { Field, MasterDataSelect, RepeatingHeader, RepeatingRow, SectionHeading } from "../field";
import { patchRow, type StepProps } from "../wizard-props";

function YesNoField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <YesNoToggle name={label} value={value} onChange={onChange} />
    </div>
  );
}

export function Step3TeamAgreement({
  state,
  errors,
  masterData,
  departments,
  updateTeam,
  updateAgreement,
  updateFinancial,
}: StepProps) {
  const t = state.team;
  const a = state.agreement;
  const f = state.financial;

  const members = t.members;
  const experts = t.externalExperts;
  const schedule = f.paymentSchedule;
  const scheduleTotal = schedule.reduce((sum, row) => sum + (Number(row.plannedAmount) || 0), 0);
  const totalValue = Number(f.totalValue) || 0;
  const contributionTotal = members.reduce((sum, m) => sum + (Number(m.contributionPercent) || 0), 0);
  const anyContribution = members.some((m) => m.contributionPercent.trim() !== "");

  function toggleDepartmentInvolved(id: string) {
    const set = new Set(t.departmentsInvolved);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    updateTeam({ departmentsInvolved: [...set] });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <RepeatingHeader
          title="Consultancy Team"
          addLabel="Add Consultant"
          onAdd={() => updateTeam({ members: [...members, emptyTeamMember()] })}
          error={errors.members}
        />
        <p className="text-sm text-muted-foreground">
          Exactly one member must be the Principal Consultant. Contribution percentages are optional, but if entered they must total 100%.
        </p>
        {members.map((m, i) => (
          <RepeatingRow
            key={i}
            title={m.role === "principal_consultant" ? "Principal Consultant" : `Team Member ${i + 1}`}
            removeLabel={`Remove team member ${i + 1}`}
            canRemove={members.length > 1}
            onRemove={() => updateTeam({ members: members.filter((_, j) => j !== i) })}
          >
            <Field label="Name" htmlFor={`member-name-${i}`} required error={errors[`members.${i}.name`]}>
              <Input id={`member-name-${i}`} value={m.name} onChange={(e) => updateTeam({ members: patchRow(members, i, { name: e.target.value }) })} />
            </Field>
            <Field label="Role in Consultancy" htmlFor={`member-role-${i}`} required error={errors[`members.${i}.role`]}>
              <MasterDataSelect
                id={`member-role-${i}`}
                options={masterData.team_role ?? []}
                value={m.role}
                onChange={(v) => updateTeam({ members: patchRow(members, i, { role: v }) })}
                placeholder="Select role"
              />
            </Field>
            <Field label="Employee ID" htmlFor={`member-emp-${i}`} error={errors[`members.${i}.employeeId`]}>
              <Input
                id={`member-emp-${i}`}
                value={m.employeeId}
                onChange={(e) => updateTeam({ members: patchRow(members, i, { employeeId: e.target.value }) })}
              />
            </Field>
            <Field label="Department" htmlFor={`member-dept-${i}`} required error={errors[`members.${i}.department`]}>
              <Input
                id={`member-dept-${i}`}
                value={m.department}
                onChange={(e) => updateTeam({ members: patchRow(members, i, { department: e.target.value }) })}
              />
            </Field>
            <Field label="Designation" htmlFor={`member-desig-${i}`}>
              <Input
                id={`member-desig-${i}`}
                value={m.designation}
                onChange={(e) => updateTeam({ members: patchRow(members, i, { designation: e.target.value }) })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Est. Hours" htmlFor={`member-hours-${i}`} error={errors[`members.${i}.estimatedHours`]}>
                <Input
                  id={`member-hours-${i}`}
                  type="number"
                  min="0"
                  value={m.estimatedHours}
                  onChange={(e) => updateTeam({ members: patchRow(members, i, { estimatedHours: e.target.value }) })}
                />
              </Field>
              <Field label="Contribution %" htmlFor={`member-pct-${i}`} error={errors[`members.${i}.contributionPercent`]}>
                <Input
                  id={`member-pct-${i}`}
                  type="number"
                  min="0"
                  max="100"
                  value={m.contributionPercent}
                  onChange={(e) => updateTeam({ members: patchRow(members, i, { contributionPercent: e.target.value }) })}
                />
              </Field>
            </div>
          </RepeatingRow>
        ))}
        {anyContribution && (
          <p className={contributionTotal === 100 ? "text-sm text-muted-foreground" : "text-sm text-status-warning-fg"}>
            Contribution total: {contributionTotal}%
          </p>
        )}

        <Field label="Roles & Responsibilities" htmlFor="team-roles" error={errors.rolesAndResponsibilities}>
          <Textarea id="team-roles" value={t.rolesAndResponsibilities} onChange={(e) => updateTeam({ rolesAndResponsibilities: e.target.value })} />
        </Field>

        {departments.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Other Departments Involved</Label>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((d) => (
                <label key={d.id} htmlFor={`dept-involved-${d.id}`} className="flex min-h-11 items-center gap-2 text-sm md:min-h-8">
                  <Checkbox
                    id={`dept-involved-${d.id}`}
                    checked={t.departmentsInvolved.includes(d.id)}
                    onCheckedChange={() => toggleDepartmentInvolved(d.id)}
                  />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>External Expert</SectionHeading>
        <YesNoField
          label="Is an external expert involved?"
          value={t.externalExpertInvolved}
          onChange={(v) =>
            updateTeam({ externalExpertInvolved: v, externalExperts: v && experts.length === 0 ? [emptyExternalExpert()] : experts })
          }
        />
        {t.externalExpertInvolved && (
          <>
            <RepeatingHeader
              title="External Experts"
              addLabel="Add Expert"
              onAdd={() => updateTeam({ externalExperts: [...experts, emptyExternalExpert()] })}
              error={errors.externalExperts}
            />
            {experts.map((e, i) => (
              <RepeatingRow
                key={i}
                title={`External Expert ${i + 1}`}
                removeLabel={`Remove external expert ${i + 1}`}
                canRemove={experts.length > 1}
                onRemove={() => updateTeam({ externalExperts: experts.filter((_, j) => j !== i) })}
              >
                <Field label="Name" htmlFor={`expert-name-${i}`} required error={errors[`externalExperts.${i}.name`]}>
                  <Input id={`expert-name-${i}`} value={e.name} onChange={(ev) => updateTeam({ externalExperts: patchRow(experts, i, { name: ev.target.value }) })} />
                </Field>
                <Field label="Organisation" htmlFor={`expert-org-${i}`} required error={errors[`externalExperts.${i}.organisation`]}>
                  <Input
                    id={`expert-org-${i}`}
                    value={e.organisation}
                    onChange={(ev) => updateTeam({ externalExperts: patchRow(experts, i, { organisation: ev.target.value }) })}
                  />
                </Field>
                <Field label="Expertise" htmlFor={`expert-expertise-${i}`}>
                  <Input
                    id={`expert-expertise-${i}`}
                    value={e.expertise}
                    onChange={(ev) => updateTeam({ externalExperts: patchRow(experts, i, { expertise: ev.target.value }) })}
                  />
                </Field>
                <Field label="Role" htmlFor={`expert-role-${i}`} required error={errors[`externalExperts.${i}.role`]}>
                  <Input id={`expert-role-${i}`} value={e.role} onChange={(ev) => updateTeam({ externalExperts: patchRow(experts, i, { role: ev.target.value }) })} />
                </Field>
                <Field label="Engagement Terms" htmlFor={`expert-terms-${i}`} className="sm:col-span-2">
                  <Input
                    id={`expert-terms-${i}`}
                    value={e.engagementTerms}
                    onChange={(ev) => updateTeam({ externalExperts: patchRow(experts, i, { engagementTerms: ev.target.value }) })}
                  />
                </Field>
              </RepeatingRow>
            ))}
            <p className="text-xs text-muted-foreground">Upload the expert&apos;s supporting document on the Review step.</p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Agreement Details</SectionHeading>
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
          {a.agreementTypeCode === "other" && (
            <Field label="Specify Agreement Type" htmlFor="agreement-type-other" required error={errors.agreementTypeOther}>
              <Input id="agreement-type-other" value={a.agreementTypeOther} onChange={(e) => updateAgreement({ agreementTypeOther: e.target.value })} />
            </Field>
          )}
          <Field label="Agreement Number / Reference" htmlFor="agreement-number" required error={errors.agreementNumber}>
            <Input id="agreement-number" value={a.agreementNumber} onChange={(e) => updateAgreement({ agreementNumber: e.target.value })} />
          </Field>
          <Field label="Agreement Date" htmlFor="agreement-date" required error={errors.agreementDate}>
            <Input id="agreement-date" type="date" value={a.agreementDate} onChange={(e) => updateAgreement({ agreementDate: e.target.value })} />
          </Field>
          <Field label="Start Date" htmlFor="agreement-start" required error={errors.agreementStartDate}>
            <Input
              id="agreement-start"
              type="date"
              value={a.agreementStartDate}
              onChange={(e) => updateAgreement({ agreementStartDate: e.target.value })}
            />
          </Field>
          <Field label="End Date" htmlFor="agreement-end" required error={errors.agreementEndDate}>
            <Input id="agreement-end" type="date" value={a.agreementEndDate} onChange={(e) => updateAgreement({ agreementEndDate: e.target.value })} />
          </Field>
          <Field label="Renewal / Extension Clause" htmlFor="agreement-renewal" className="sm:col-span-2">
            <Input
              id="agreement-renewal"
              value={a.renewalClause}
              onChange={(e) => updateAgreement({ renewalClause: e.target.value })}
              placeholder="Optional — summarise the clause if the agreement has one"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <YesNoField label="Confidentiality Clause" value={a.confidentialityClause} onChange={(v) => updateAgreement({ confidentialityClause: v })} />
          <YesNoField label="IP Clause" value={a.ipClause} onChange={(v) => updateAgreement({ ipClause: v })} />
          <YesNoField label="Payment Terms Included" value={a.paymentTermsIncluded} onChange={(v) => updateAgreement({ paymentTermsIncluded: v })} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Financial Details</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total Consultancy Value (₹)" htmlFor="total-value" required error={errors.totalValue}>
            <Input id="total-value" type="number" min="0" value={f.totalValue} onChange={(e) => updateFinancial({ totalValue: e.target.value })} />
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
          <Field label="Payment Structure" htmlFor="payment-terms" required error={errors.paymentTermsCode}>
            <MasterDataSelect
              id="payment-terms"
              options={masterData.payment_terms ?? []}
              value={a.paymentTermsCode}
              onChange={(v) => updateAgreement({ paymentTermsCode: v })}
              placeholder="Select payment structure"
            />
          </Field>
          {a.paymentTermsCode === "other" && (
            <Field label="Specify Payment Structure" htmlFor="payment-terms-other" required error={errors.paymentTermsOther}>
              <Input id="payment-terms-other" value={a.paymentTermsOther} onChange={(e) => updateAgreement({ paymentTermsOther: e.target.value })} />
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
          {a.paymentModeCode === "other" && (
            <Field label="Specify Payment Mode" htmlFor="payment-mode-other" required error={errors.paymentModeOther}>
              <Input id="payment-mode-other" value={a.paymentModeOther} onChange={(e) => updateAgreement({ paymentModeOther: e.target.value })} />
            </Field>
          )}
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
        <YesNoField label="Is tax applicable?" value={f.taxApplicable} onChange={(v) => updateFinancial({ taxApplicable: v })} />
        {f.taxApplicable && (
          <Field label="Tax Details" htmlFor="tax-details" required error={errors.taxDetails}>
            <Input id="tax-details" value={f.taxDetails} onChange={(e) => updateFinancial({ taxDetails: e.target.value })} />
          </Field>
        )}

        <RepeatingHeader
          title="Payment Schedule"
          addLabel="Add Stage"
          onAdd={() => updateFinancial({ paymentSchedule: [...schedule, emptyPaymentStage()] })}
          error={errors.paymentSchedule}
        />
        {schedule.map((row, i) => (
          <RepeatingRow
            key={i}
            title={`Stage ${i + 1}`}
            removeLabel={`Remove payment stage ${i + 1}`}
            canRemove={schedule.length > 1}
            onRemove={() => updateFinancial({ paymentSchedule: schedule.filter((_, j) => j !== i) })}
          >
            <Field label="Payment Stage" htmlFor={`pay-stage-${i}`} required error={errors[`paymentSchedule.${i}.stageLabel`]}>
              <Input
                id={`pay-stage-${i}`}
                value={row.stageLabel}
                onChange={(e) => updateFinancial({ paymentSchedule: patchRow(schedule, i, { stageLabel: e.target.value }) })}
                placeholder="e.g. Advance"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (₹)" htmlFor={`pay-amount-${i}`} required error={errors[`paymentSchedule.${i}.plannedAmount`]}>
                <Input
                  id={`pay-amount-${i}`}
                  type="number"
                  min="0"
                  value={row.plannedAmount}
                  onChange={(e) => updateFinancial({ paymentSchedule: patchRow(schedule, i, { plannedAmount: e.target.value }) })}
                />
              </Field>
              <Field label="Due Date" htmlFor={`pay-due-${i}`} required error={errors[`paymentSchedule.${i}.plannedDate`]}>
                <Input
                  id={`pay-due-${i}`}
                  type="date"
                  value={row.plannedDate}
                  onChange={(e) => updateFinancial({ paymentSchedule: patchRow(schedule, i, { plannedDate: e.target.value }) })}
                />
              </Field>
            </div>
          </RepeatingRow>
        ))}
        <p className={Math.abs(scheduleTotal - totalValue) < 0.01 ? "text-sm text-muted-foreground" : "text-sm text-status-warning-fg"}>
          Scheduled {formatInr(scheduleTotal)} of {formatInr(totalValue)}
        </p>
        <div className="flex gap-2 rounded-md bg-background p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            All consultancy payments are made to the designated CAIAS institutional account — never to an individual. Payment instructions
            are provided by CAIAS Finance/Accounts; payment status and receipts are recorded by Finance.
          </p>
        </div>
      </section>
    </div>
  );
}
