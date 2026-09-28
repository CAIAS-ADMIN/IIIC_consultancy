"use client";

import { Input } from "@/components/ui/input";
import { durationInDays, emptyDeliverable, emptyMilestone } from "@/lib/wizard/types";
import { Field, MasterDataSelect, RepeatingHeader, RepeatingRow, SectionHeading } from "../field";
import { patchRow, type StepProps } from "../wizard-props";

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value || "—"}</span>
    </div>
  );
}

export function Step5TimelineMilestones({
  state,
  errors,
  masterData,
  updateConsultancy,
  updateTimeline,
  updateScope,
  updateAgreement,
}: StepProps) {
  const c = state.consultancy;
  const milestones = state.timeline.milestones;
  const duration = durationInDays(c.startDate, c.expectedCompletionDate);

  function handleStartDateChange(date: string) {
    updateConsultancy({ startDate: date });
    // Keep Agreement dates in sync
    updateAgreement({ agreementStartDate: date });
  }

  function handleCompletionDateChange(date: string) {
    updateConsultancy({ expectedCompletionDate: date });
    // Keep Agreement dates in sync
    updateAgreement({ agreementEndDate: date });
  }

  function handleAddMilestone() {
    updateTimeline({ milestones: [...milestones, emptyMilestone()] });
    updateScope({ deliverables: [...state.scope.deliverables, emptyDeliverable()] });
  }

  function handleRemoveMilestone(index: number) {
    updateTimeline({ milestones: milestones.filter((_, j) => j !== index) });
    if (state.scope.deliverables.length > index) {
      updateScope({ deliverables: state.scope.deliverables.filter((_, j) => j !== index) });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeading>Consultancy Schedule & Timeline</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Consultancy Start Date" htmlFor="c-start-date" required error={errors.startDate}>
            <Input
              id="c-start-date"
              type="date"
              value={c.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
            />
          </Field>
          <Field label="Expected Completion Date" htmlFor="c-completion-date" required error={errors.expectedCompletionDate}>
            <Input
              id="c-completion-date"
              type="date"
              value={c.expectedCompletionDate}
              onChange={(e) => handleCompletionDateChange(e.target.value)}
            />
          </Field>
          <div className="flex flex-col justify-center rounded-lg border border-border bg-background p-3">
            <ReadOnlyValue label="Calculated Duration" value={duration === null ? "Select valid dates" : `${duration} Day${duration === 1 ? "" : "s"}`} />
          </div>
          <Field label="Progress Reporting Frequency" htmlFor="c-reporting" required error={errors.reportingFrequency} className="sm:col-span-2">
            <MasterDataSelect
              id="c-reporting"
              options={masterData.reporting_frequency ?? []}
              value={c.reportingFrequency}
              onChange={(v) => updateConsultancy({ reportingFrequency: v })}
            />
          </Field>
          {c.reportingFrequency === "custom" && (
            <Field label="Specify Custom Frequency" htmlFor="c-reporting-other" required error={errors.reportingFrequencyOther}>
              <Input
                id="c-reporting-other"
                value={c.reportingFrequencyOther}
                onChange={(e) => updateConsultancy({ reportingFrequencyOther: e.target.value })}
                placeholder="e.g. Bi-weekly updates"
              />
            </Field>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <RepeatingHeader
          title="Milestones & Deliverables Schedule"
          addLabel="Add Milestone / Deliverable"
          onAdd={handleAddMilestone}
          error={errors.milestones}
        />
        <p className="text-xs text-muted-foreground">
          Define each milestone, target completion date, assigned consultant, and expected deliverable output.
        </p>
        {milestones.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No milestones added yet. Click &quot;Add Milestone / Deliverable&quot; above to create a schedule.
          </div>
        )}
        {milestones.map((m, i) => (
          <RepeatingRow
            key={i}
            title={`Milestone ${i + 1}`}
            removeLabel={`Remove milestone ${i + 1}`}
            canRemove={milestones.length > 0}
            onRemove={() => handleRemoveMilestone(i)}
          >
            <Field label="Milestone Title" htmlFor={`ms-title-${i}`} required error={errors[`milestones.${i}.title`]}>
              <Input
                id={`ms-title-${i}`}
                value={m.title}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { title: e.target.value }) })}
                placeholder="e.g. Requirement Analysis & Training Setup"
              />
            </Field>
            <Field label="Responsible Consultant / Person" htmlFor={`ms-resp-${i}`} required error={errors[`milestones.${i}.responsiblePerson`]}>
              <Input
                id={`ms-resp-${i}`}
                value={m.responsiblePerson}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { responsiblePerson: e.target.value }) })}
                placeholder="e.g. Dr. Arun Kumar"
              />
            </Field>
            <Field label="Milestone Start Date" htmlFor={`ms-start-${i}`} required error={errors[`milestones.${i}.startDate`]}>
              <Input
                id={`ms-start-${i}`}
                type="date"
                value={m.startDate}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { startDate: e.target.value }) })}
              />
            </Field>
            <Field label="Target Completion Date" htmlFor={`ms-end-${i}`} required error={errors[`milestones.${i}.plannedDate`]}>
              <Input
                id={`ms-end-${i}`}
                type="date"
                value={m.plannedDate}
                onChange={(e) => updateTimeline({ milestones: patchRow(milestones, i, { plannedDate: e.target.value }) })}
              />
            </Field>
            <Field label="Description & Key Deliverable Output" htmlFor={`ms-desc-${i}`} required error={errors[`milestones.${i}.description`]} className="sm:col-span-2">
              <Input
                id={`ms-desc-${i}`}
                value={m.description}
                onChange={(e) => {
                  updateTimeline({ milestones: patchRow(milestones, i, { description: e.target.value }) });
                  if (state.scope.deliverables[i]) {
                    updateScope({
                      deliverables: patchRow(state.scope.deliverables, i, {
                        name: m.title || `Deliverable ${i + 1}`,
                        description: e.target.value,
                        dueDate: m.plannedDate,
                        responsibleConsultant: m.responsiblePerson,
                      }),
                    });
                  }
                }}
                placeholder="Describe key activity and deliverable output (e.g. Analytics Prototype & Guidance Note)"
              />
            </Field>
          </RepeatingRow>
        ))}
      </section>
    </div>
  );
}
