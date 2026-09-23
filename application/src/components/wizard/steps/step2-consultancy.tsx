"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { Field, MasterDataSelect, SectionHeading } from "../field";
import { emptyDeliverable } from "@/lib/wizard/types";
import type { StepProps } from "../wizard-props";

export function Step2Consultancy({
  state,
  errors,
  masterData,
  departments,
  updateConsultancy,
  updateScope,
  updateResources,
}: StepProps) {
  const c = state.consultancy;
  const s = state.scope;
  const r = state.resources;
  const isAreaOther = c.consultancyAreaCode === "other";

  function updateDeliverable(index: number, patch: Partial<(typeof s.deliverables)[number]>) {
    updateScope({
      deliverables: s.deliverables.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    });
  }

  function addDeliverable() {
    updateScope({ deliverables: [...s.deliverables, emptyDeliverable()] });
  }

  function removeDeliverable(index: number) {
    updateScope({ deliverables: s.deliverables.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Consultancy Title" htmlFor="c-title" required error={errors.title} className="sm:col-span-2">
          <Input
            id="c-title"
            value={c.title}
            onChange={(e) => updateConsultancy({ title: e.target.value })}
            placeholder="e.g. AI-based Analytics Training Program"
          />
        </Field>
        <Field label="Department" htmlFor="c-department" required error={errors.departmentId}>
          <MasterDataSelect
            id="c-department"
            options={departments.map((d) => ({ code: d.id, label: d.name }))}
            value={c.departmentId}
            onChange={(v) => updateConsultancy({ departmentId: v })}
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
        {isAreaOther && (
          <Field label="Specify Consultancy Area" htmlFor="c-area-other" required error={errors.consultancyAreaOther}>
            <Input
              id="c-area-other"
              value={c.consultancyAreaOther}
              onChange={(e) => updateConsultancy({ consultancyAreaOther: e.target.value })}
            />
          </Field>
        )}
        <Field label="Start Date" htmlFor="c-start-date" required error={errors.startDate}>
          <Input
            id="c-start-date"
            type="date"
            value={c.startDate}
            onChange={(e) => updateConsultancy({ startDate: e.target.value })}
          />
        </Field>
        <Field
          label="Expected Completion Date"
          htmlFor="c-completion-date"
          required
          error={errors.expectedCompletionDate}
        >
          <Input
            id="c-completion-date"
            type="date"
            value={c.expectedCompletionDate}
            onChange={(e) => updateConsultancy({ expectedCompletionDate: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="c-description" error={errors.description}>
        <Textarea
          id="c-description"
          value={c.description}
          onChange={(e) => updateConsultancy({ description: e.target.value })}
          placeholder="Brief internal description (optional)"
        />
      </Field>

      <Field label="Scope of Work" htmlFor="c-scope" required error={errors.scopeOfWork}>
        <Textarea
          id="c-scope"
          value={s.scopeOfWork}
          onChange={(e) => updateScope({ scopeOfWork: e.target.value })}
          placeholder="Describe the scope and objectives of this consultancy"
        />
      </Field>

      <Field label="Expected Outcomes" htmlFor="c-outcomes" error={errors.expectedOutcomes}>
        <Textarea
          id="c-outcomes"
          value={s.expectedOutcomes}
          onChange={(e) => updateScope({ expectedOutcomes: e.target.value })}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionHeading>Deliverables</SectionHeading>
          <Button type="button" variant="secondary" size="sm" onClick={addDeliverable}>
            <Plus className="h-4 w-4" aria-hidden />
            Add Deliverable
          </Button>
        </div>
        {errors["deliverables"] && <p className="text-sm text-status-danger-fg">{errors["deliverables"]}</p>}
        <div className="flex flex-col gap-3">
          {s.deliverables.map((d, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-end">
              <Field label={`Deliverable ${i + 1}`} htmlFor={`deliverable-desc-${i}`} className="flex-1">
                <Input
                  id={`deliverable-desc-${i}`}
                  value={d.description}
                  onChange={(e) => updateDeliverable(i, { description: e.target.value })}
                  placeholder="e.g. Final report"
                />
              </Field>
              <Field label="Due Date" htmlFor={`deliverable-due-${i}`} className="sm:w-44">
                <Input
                  id={`deliverable-due-${i}`}
                  type="date"
                  value={d.dueDate}
                  onChange={(e) => updateDeliverable(i, { dueDate: e.target.value })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove deliverable"
                onClick={() => removeDeliverable(i)}
                disabled={s.deliverables.length === 1}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>Client Acceptance Required?</Label>
          <YesNoToggle
            name="clientAcceptanceRequired"
            value={s.clientAcceptanceRequired}
            onChange={(v) => updateScope({ clientAcceptanceRequired: v })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Does this consultancy require an NDA?</Label>
          <YesNoToggle name="ndaRequired" value={r.ndaRequired} onChange={(v) => updateResources({ ndaRequired: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Does this consultancy generate Intellectual Property?</Label>
          <YesNoToggle
            name="ipAgreementRequired"
            value={r.ipAgreementRequired}
            onChange={(v) => updateResources({ ipAgreementRequired: v })}
          />
        </div>
      </div>
    </div>
  );
}
