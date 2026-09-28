"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { emptyExternalExpert, emptyTeamMember } from "@/lib/wizard/types";
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

export function Step4TeamAgreement({
  state,
  errors,
  masterData,
  departments,
  updateTeam,
  updateAgreement,
}: StepProps) {
  const t = state.team;
  const a = state.agreement;
  const members = t.members;
  const contributionTotal = members.reduce((sum, m) => sum + (Number(m.contributionPercent) || 0), 0);
  const anyContribution = members.some((m) => m.contributionPercent.trim() !== "");
  const experts = t.externalExperts;

  function toggleDepartmentInvolved(id: string) {
    const set = new Set(t.departmentsInvolved);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    updateTeam({ departmentsInvolved: [...set] });
  }

  return (
    <div className="flex flex-col gap-8">
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
          <Field label="Agreement Reference / Document No." htmlFor="agreement-number" required error={errors.agreementNumber}>
            <Input id="agreement-number" value={a.agreementNumber} onChange={(e) => updateAgreement({ agreementNumber: e.target.value })} placeholder="e.g 46151504-NASPO-17-ACS" />
          </Field>
          <Field label="Agreement Execution Date" htmlFor="agreement-date" required error={errors.agreementDate}>
            <Input id="agreement-date" type="date" value={a.agreementDate} onChange={(e) => updateAgreement({ agreementDate: e.target.value })} />
          </Field>
          <Field label="Renewal / Extension Clause" htmlFor="agreement-renewal" className="sm:col-span-2">
            <Input
              id="agreement-renewal"
              value={a.renewalClause}
              onChange={(e) => updateAgreement({ renewalClause: e.target.value })}
              placeholder="Optional — summarise renewal clause if present"
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <RepeatingHeader
          title="Consultancy Team Members"
          addLabel="Add Team Member"
          onAdd={() => updateTeam({ members: [...members, emptyTeamMember()] })}
          error={errors.members}
        />
        <p className="text-xs text-muted-foreground">
          Every consultancy must include one Principal Consultant. Specify team roles, estimated hours and each member&apos;s contribution — if
          contributions are entered, every member needs one and they must total 100%.
        </p>
        {members.map((m, i) => (
          <RepeatingRow
            key={i}
            title={m.role === "principal_consultant" ? "Principal Consultant (Lead)" : `Team Member ${i + 1}`}
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
            {m.role === "other" && (
              <Field label="Specify Role" htmlFor={`member-role-other-${i}`} required error={errors[`members.${i}.roleOther`]}>
                <Input
                  id={`member-role-other-${i}`}
                  value={m.roleOther}
                  onChange={(e) => updateTeam({ members: patchRow(members, i, { roleOther: e.target.value }) })}
                  placeholder="Type the role"
                />
              </Field>
            )}
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
            <Field label="Estimated Hours" htmlFor={`member-hours-${i}`} error={errors[`members.${i}.estimatedHours`]}>
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
                placeholder="e.g. 50"
              />
            </Field>
          </RepeatingRow>
        ))}
        {anyContribution && (
          <p role="status" className={contributionTotal === 100 ? "text-sm text-muted-foreground" : "text-sm font-medium text-status-warning-fg"}>
            Contribution total: {contributionTotal}%{contributionTotal === 100 ? "" : " — must total 100%"}
          </p>
        )}

        <Field label="Overall Team Roles & Responsibilities" htmlFor="team-roles" error={errors.rolesAndResponsibilities}>
          <Textarea id="team-roles" rows={3} value={t.rolesAndResponsibilities} onChange={(e) => updateTeam({ rolesAndResponsibilities: e.target.value })} placeholder="Summarise overall division of responsibilities..." />
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
        <SectionHeading>External Expert Involvement</SectionHeading>
        <YesNoField
          label="Is an external expert / industry expert involved?"
          value={t.externalExpertInvolved}
          onChange={(v) =>
            updateTeam({ externalExpertInvolved: v, externalExperts: v && experts.length === 0 ? [emptyExternalExpert()] : experts })
          }
        />
        {t.externalExpertInvolved && (
          <>
            <RepeatingHeader
              title="External Experts Details"
              addLabel="Add External Expert"
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
                <Field label="Area of Expertise" htmlFor={`expert-expertise-${i}`}>
                  <Input
                    id={`expert-expertise-${i}`}
                    value={e.expertise}
                    onChange={(ev) => updateTeam({ externalExperts: patchRow(experts, i, { expertise: ev.target.value }) })}
                  />
                </Field>
                <Field label="Role in Consultancy" htmlFor={`expert-role-${i}`} required error={errors[`externalExperts.${i}.role`]}>
                  <Input id={`expert-role-${i}`} value={e.role} onChange={(ev) => updateTeam({ externalExperts: patchRow(experts, i, { role: ev.target.value }) })} />
                </Field>
                <Field label="Engagement Terms" htmlFor={`expert-terms-${i}`} className="sm:col-span-2">
                  <Input
                    id={`expert-terms-${i}`}
                    value={e.engagementTerms}
                    onChange={(ev) => updateTeam({ externalExperts: patchRow(experts, i, { engagementTerms: ev.target.value }) })}
                    placeholder="e.g. Sub-contract basis / Honorarium"
                  />
                </Field>
              </RepeatingRow>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
