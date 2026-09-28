"use client";

import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { AGREEMENT_NOT_SIGNED_MESSAGE, AGREEMENT_SIGNED_OPTIONS } from "@/lib/validation/consultancy";
import { durationInDays, emptyDeliverable, emptyMilestone } from "@/lib/wizard/types";
import { CheckboxGroup, Field, MasterDataSelect, RepeatingHeader, RepeatingRow, SectionHeading } from "../field";
import { patchRow, type StepProps } from "../wizard-props";

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

export function Step2Consultancy({
  state,
  errors,
  masterData,
  departments,
  staff,
  principal,
  updateConsultancy,
  updateScope,
  updateTimeline,
}: StepProps) {
  const c = state.consultancy;
  const s = state.scope;
  const milestones = state.timeline.milestones;
  const duration = durationInDays(c.startDate, c.expectedCompletionDate);
  const departmentStaff = staff.filter((u) => u.departmentId === c.departmentId);
  const hod = departmentStaff.find((u) => u.roles.includes("hod"));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeading>Agreement Status</SectionHeading>
        <Field
          label="Has an MoU / Consultancy Agreement / Work Order been signed?"
          htmlFor="c-agreement-signed"
          required
          error={errors.agreementSignedStatus !== AGREEMENT_NOT_SIGNED_MESSAGE ? errors.agreementSignedStatus : undefined}
        >
          <MasterDataSelect
            id="c-agreement-signed"
            options={[...AGREEMENT_SIGNED_OPTIONS]}
            value={c.agreementSignedStatus}
            onChange={(v) => updateConsultancy({ agreementSignedStatus: v })}
            placeholder="Select"
          />
        </Field>
        {c.agreementSignedStatus === "no" && (
          <div role="status" className="flex gap-2 rounded-md bg-accent-soft p-3 text-sm text-accent-soft-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{AGREEMENT_NOT_SIGNED_MESSAGE} You can keep working and save this as a draft.</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Institutional Details</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department" htmlFor="c-department" required error={errors.departmentId}>
            <MasterDataSelect
              id="c-department"
              options={departments.map((d) => ({ code: d.id, label: d.name }))}
              value={c.departmentId}
              onChange={(v) => updateConsultancy({ departmentId: v, departmentCoordinatorId: "" })}
              placeholder="Select department"
            />
          </Field>
          <Field label="Academic Year" htmlFor="c-academic-year" required error={errors.academicYearCode}>
            <MasterDataSelect
              id="c-academic-year"
              options={masterData.academic_year ?? []}
              value={c.academicYearCode}
              onChange={(v) => updateConsultancy({ academicYearCode: v })}
              placeholder="Select academic year"
            />
          </Field>
          <Field label="Department Consultancy Coordinator" htmlFor="c-coordinator" error={errors.departmentCoordinatorId}>
            <MasterDataSelect
              id="c-coordinator"
              options={departmentStaff.map((u) => ({ code: u.id, label: u.name }))}
              value={c.departmentCoordinatorId}
              onChange={(v) => updateConsultancy({ departmentCoordinatorId: v })}
              placeholder={c.departmentId ? "Select coordinator" : "Select a department first"}
              disabled={!c.departmentId || departmentStaff.length === 0}
            />
          </Field>
          <ReadOnlyValue label="HOD" value={hod?.name ?? ""} />
        </div>
        <div className="grid gap-4 rounded-md bg-background p-3 sm:grid-cols-4">
          <ReadOnlyValue label="Faculty Consultant" value={principal.name} />
          <ReadOnlyValue label="Employee ID" value={principal.employeeId} />
          <ReadOnlyValue label="Official Email" value={principal.email} />
          <ReadOnlyValue label="Contact Number" value={principal.phone} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Basic Consultancy Information</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Consultancy Title" htmlFor="c-title" required error={errors.title} className="sm:col-span-2">
            <Input
              id="c-title"
              value={c.title}
              onChange={(e) => updateConsultancy({ title: e.target.value })}
              placeholder="Short descriptive title"
            />
          </Field>
          <Field label="Nature of Consultancy" htmlFor="c-nature" required error={errors.natureOfConsultancyCode}>
            <MasterDataSelect
              id="c-nature"
              options={masterData.nature_of_consultancy ?? []}
              value={c.natureOfConsultancyCode}
              onChange={(v) => updateConsultancy({ natureOfConsultancyCode: v })}
              placeholder="Select nature of consultancy"
            />
          </Field>
          {c.natureOfConsultancyCode === "other" && (
            <Field label="Specify Nature of Consultancy" htmlFor="c-nature-other" required error={errors.natureOfConsultancyOther}>
              <Input
                id="c-nature-other"
                value={c.natureOfConsultancyOther}
                onChange={(e) => updateConsultancy({ natureOfConsultancyOther: e.target.value })}
              />
            </Field>
          )}
          <Field label="Consultancy Category" htmlFor="c-category" error={errors.consultancyCategoryCode}>
            <MasterDataSelect
              id="c-category"
              options={masterData.consultancy_category ?? []}
              value={c.consultancyCategoryCode}
              onChange={(v) => updateConsultancy({ consultancyCategoryCode: v })}
              placeholder="Select category"
            />
          </Field>
          <Field label="Consultancy Type" htmlFor="c-type" required error={errors.consultancyTypeCode}>
            <MasterDataSelect
              id="c-type"
              options={masterData.consultancy_type ?? []}
              value={c.consultancyTypeCode}
              onChange={(v) => updateConsultancy({ consultancyTypeCode: v })}
              placeholder="Select consultancy type"
            />
          </Field>
          <Field label="Team Type" htmlFor="c-team-type" required error={errors.teamTypeCode}>
            <MasterDataSelect
              id="c-team-type"
              options={masterData.team_type ?? []}
              value={c.teamTypeCode}
              onChange={(v) => updateConsultancy({ teamTypeCode: v })}
              placeholder="Select team type"
            />
          </Field>
          <Field label="Consultancy Area" htmlFor="c-area" required error={errors.consultancyAreaCode}>
            <MasterDataSelect
              id="c-area"
              options={masterData.consultancy_area ?? []}
              value={c.consultancyAreaCode}
              onChange={(v) => updateConsultancy({ consultancyAreaCode: v })}
              placeholder="Select consultancy area"
            />
          </Field>
          {c.consultancyAreaCode === "other" && (
            <Field label="Specify Consultancy Area" htmlFor="c-area-other" required error={errors.consultancyAreaOther}>
              <Input
                id="c-area-other"
                value={c.consultancyAreaOther}
                onChange={(e) => updateConsultancy({ consultancyAreaOther: e.target.value })}
              />
            </Field>
          )}
        </div>
        <Field label="Consultancy Domain (select all that apply)" required error={errors.consultancyDomainCodes}>
          <CheckboxGroup
            idPrefix="c-domain"
            label="Consultancy Domain"
            options={masterData.consultancy_domain ?? []}
            value={c.consultancyDomainCodes}
            onChange={(v) => updateConsultancy({ consultancyDomainCodes: v })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Consultancy Description</SectionHeading>
        <Field label="Problem / Requirement of Client" htmlFor="c-problem" required error={errors.clientProblem}>
          <Textarea id="c-problem" value={c.clientProblem} onChange={(e) => updateConsultancy({ clientProblem: e.target.value })} />
        </Field>
        <Field label="Objective of Consultancy" htmlFor="c-objective" required error={errors.objective}>
          <Textarea id="c-objective" value={c.objective} onChange={(e) => updateConsultancy({ objective: e.target.value })} />
        </Field>
        <Field label="Scope of Work" htmlFor="c-scope" required error={errors.scopeOfWork}>
          <Textarea id="c-scope" value={s.scopeOfWork} onChange={(e) => updateScope({ scopeOfWork: e.target.value })} />
        </Field>
        <Field label="Expected Outcomes" htmlFor="c-outcomes" required error={errors.expectedOutcomes}>
          <Textarea id="c-outcomes" value={s.expectedOutcomes} onChange={(e) => updateScope({ expectedOutcomes: e.target.value })} />
        </Field>
        <Field label="Additional Notes" htmlFor="c-description" error={errors.description}>
          <Textarea
            id="c-description"
            value={c.description}
            onChange={(e) => updateConsultancy({ description: e.target.value })}
            placeholder="Optional internal notes"
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Label>Client acceptance required at closure?</Label>
          <YesNoToggle
            name="Client acceptance required at closure"
            value={s.clientAcceptanceRequired}
            onChange={(v) => updateScope({ clientAcceptanceRequired: v })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <RepeatingHeader
          title="Key Deliverables"
          addLabel="Add Deliverable"
          onAdd={() => updateScope({ deliverables: [...s.deliverables, emptyDeliverable()] })}
          error={errors.deliverables}
        />
        {s.deliverables.map((d, i) => (
          <RepeatingRow
            key={i}
            title={`Deliverable ${i + 1}`}
            removeLabel={`Remove deliverable ${i + 1}`}
            canRemove={s.deliverables.length > 1}
            onRemove={() => updateScope({ deliverables: s.deliverables.filter((_, j) => j !== i) })}
          >
            <Field label="Deliverable Name" htmlFor={`deliverable-name-${i}`} required error={errors[`deliverables.${i}.name`]}>
              <Input
                id={`deliverable-name-${i}`}
                value={d.name}
                onChange={(e) => updateScope({ deliverables: patchRow(s.deliverables, i, { name: e.target.value }) })}
                placeholder="e.g. Final Consultancy Report"
              />
            </Field>
            <Field label="Expected Date" htmlFor={`deliverable-due-${i}`} error={errors[`deliverables.${i}.dueDate`]}>
              <Input
                id={`deliverable-due-${i}`}
                type="date"
                value={d.dueDate}
                onChange={(e) => updateScope({ deliverables: patchRow(s.deliverables, i, { dueDate: e.target.value }) })}
              />
            </Field>
            <Field label="Responsible Consultant" htmlFor={`deliverable-resp-${i}`}>
              <Input
                id={`deliverable-resp-${i}`}
                value={d.responsibleConsultant}
                onChange={(e) => updateScope({ deliverables: patchRow(s.deliverables, i, { responsibleConsultant: e.target.value }) })}
              />
            </Field>
            <Field label="Description" htmlFor={`deliverable-desc-${i}`}>
              <Input
                id={`deliverable-desc-${i}`}
                value={d.description}
                onChange={(e) => updateScope({ deliverables: patchRow(s.deliverables, i, { description: e.target.value }) })}
              />
            </Field>
          </RepeatingRow>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Timeline</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Consultancy Start Date" htmlFor="c-start-date" required error={errors.startDate}>
            <Input id="c-start-date" type="date" value={c.startDate} onChange={(e) => updateConsultancy({ startDate: e.target.value })} />
          </Field>
          <Field label="Expected Completion Date" htmlFor="c-completion-date" required error={errors.expectedCompletionDate}>
            <Input
              id="c-completion-date"
              type="date"
              value={c.expectedCompletionDate}
              onChange={(e) => updateConsultancy({ expectedCompletionDate: e.target.value })}
            />
          </Field>
          <ReadOnlyValue label="Consultancy Duration" value={duration === null ? "" : `${duration} Day${duration === 1 ? "" : "s"}`} />
          <Field label="Progress Reporting Frequency" htmlFor="c-reporting" required error={errors.reportingFrequency}>
            <MasterDataSelect
              id="c-reporting"
              options={masterData.reporting_frequency ?? []}
              value={c.reportingFrequency}
              onChange={(v) => updateConsultancy({ reportingFrequency: v })}
            />
          </Field>
          {c.reportingFrequency === "custom" && (
            <Field label="Custom Frequency" htmlFor="c-reporting-other" required error={errors.reportingFrequencyOther} className="sm:col-span-2">
              <Input
                id="c-reporting-other"
                value={c.reportingFrequencyOther}
                onChange={(e) => updateConsultancy({ reportingFrequencyOther: e.target.value })}
                placeholder="e.g. Every 6 weeks"
              />
            </Field>
          )}
        </div>

        <RepeatingHeader
          title="Milestones"
          addLabel="Add Milestone"
          onAdd={() => updateTimeline({ milestones: [...milestones, emptyMilestone()] })}
          error={errors.milestones}
        />
        {milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones planned yet.</p>}
        {milestones.map((m, i) => (
          <RepeatingRow
            key={i}
            title={`Milestone ${i + 1}`}
            removeLabel={`Remove milestone ${i + 1}`}
            onRemove={() => updateTimeline({ milestones: milestones.filter((_, j) => j !== i) })}
          >
            <Field label="Milestone" htmlFor={`ms-title-${i}`} required error={errors[`milestones.${i}.title`]}>
              <Input
                id={`ms-title-${i}`}
                value={m.title}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { title: e.target.value }) })}
                placeholder="e.g. Requirement Analysis"
              />
            </Field>
            <Field label="Responsible Person" htmlFor={`ms-resp-${i}`} required error={errors[`milestones.${i}.responsiblePerson`]}>
              <Input
                id={`ms-resp-${i}`}
                value={m.responsiblePerson}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { responsiblePerson: e.target.value }) })}
              />
            </Field>
            <Field label="Start Date" htmlFor={`ms-start-${i}`} required error={errors[`milestones.${i}.startDate`]}>
              <Input
                id={`ms-start-${i}`}
                type="date"
                value={m.startDate}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { startDate: e.target.value }) })}
              />
            </Field>
            <Field label="Expected Completion" htmlFor={`ms-end-${i}`} required error={errors[`milestones.${i}.plannedDate`]}>
              <Input
                id={`ms-end-${i}`}
                type="date"
                value={m.plannedDate}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { plannedDate: e.target.value }) })}
              />
            </Field>
            <Field label="Description" htmlFor={`ms-desc-${i}`} required error={errors[`milestones.${i}.description`]} className="sm:col-span-2">
              <Input
                id={`ms-desc-${i}`}
                value={m.description}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { description: e.target.value }) })}
              />
            </Field>
          </RepeatingRow>
        ))}
      </section>
    </div>
  );
}
