"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, MasterDataSelect, CheckboxGroup, SectionHeading } from "../field";
import type { StepProps } from "../wizard-props";

export function Step3ConsultancyScope({
  state,
  errors,
  masterData,
  updateConsultancy,
  updateScope,
}: StepProps) {
  const c = state.consultancy;
  const s = state.scope;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeading>Basic Consultancy Information</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Consultancy Title" htmlFor="c-title" required error={errors.title} className="sm:col-span-2">
            <Input
              id="c-title"
              value={c.title}
              onChange={(e) => updateConsultancy({ title: e.target.value })}
              placeholder="Short descriptive title given in MoU / Agreement"
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
                placeholder="Type the consultancy area"
              />
            </Field>
          )}
          <Field label="Consultancy Category" htmlFor="c-category" required error={errors.consultancyCategoryCode}>
            <MasterDataSelect
              id="c-category"
              options={masterData.consultancy_category ?? []}
              value={c.consultancyCategoryCode}
              onChange={(v) => updateConsultancy({ consultancyCategoryCode: v })}
              placeholder="Select category (e.g. Expertise Intensive)"
            />
          </Field>
          <Field label="Consultancy Type" htmlFor="c-type" required error={errors.consultancyTypeCode}>
            <MasterDataSelect
              id="c-type"
              options={masterData.consultancy_type ?? []}
              value={c.consultancyTypeCode}
              onChange={(v) => updateConsultancy({ consultancyTypeCode: v, teamTypeCode: v })}
              placeholder="Select consultancy scope (e.g. Individual / Departmental / Consultancy Team)"
            />
          </Field>
          {c.consultancyTypeCode === "other" && (
            <Field label="Specify Consultancy Type" htmlFor="c-type-other" required error={errors.consultancyTypeOther}>
              <Input
                id="c-type-other"
                value={c.consultancyTypeOther}
                onChange={(e) => updateConsultancy({ consultancyTypeOther: e.target.value })}
                placeholder="Specify custom consultancy type"
              />
            </Field>
          )}
        </div>

        <Field label="Consultancy Discipline / Domain (select all that apply)" required error={errors.consultancyDomainCodes}>
          <CheckboxGroup
            idPrefix="c-domain"
            label="Consultancy Discipline / Domain"
            options={masterData.consultancy_domain ?? []}
            value={c.consultancyDomainCodes}
            onChange={(v) => updateConsultancy({ consultancyDomainCodes: v })}
          />
        </Field>
        {c.consultancyDomainCodes.includes("other") && (
          <Field label="Specify Custom Discipline / Domain" htmlFor="c-domain-other" required error={errors.consultancyDomainOther}>
            <Input
              id="c-domain-other"
              value={c.consultancyDomainOther}
              onChange={(e) => updateConsultancy({ consultancyDomainOther: e.target.value })}
              placeholder="Specify custom discipline / domain"
            />
          </Field>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Consultancy Description & Scope</SectionHeading>
        <Field label="Problem / Requirement of Client" htmlFor="c-problem" required error={errors.clientProblem}>
          <Textarea id="c-problem" rows={3} value={c.clientProblem} onChange={(e) => updateConsultancy({ clientProblem: e.target.value })} placeholder="Briefly describe the client's problem or core requirement..." />
        </Field>
        <Field label="Objective of Consultancy" htmlFor="c-objective" required error={errors.objective}>
          <Textarea id="c-objective" rows={3} value={c.objective} onChange={(e) => updateConsultancy({ objective: e.target.value })} placeholder="Key objectives and aims of the consultancy engagement..." />
        </Field>
        <Field label="Scope of Work" htmlFor="c-scope" required error={errors.scopeOfWork}>
          <Textarea id="c-scope" rows={4} value={s.scopeOfWork} onChange={(e) => updateScope({ scopeOfWork: e.target.value })} placeholder="Detailed scope boundaries and activities to be undertaken..." />
        </Field>
        <Field label="Expected Outcomes" htmlFor="c-outcomes" required error={errors.expectedOutcomes}>
          <Textarea id="c-outcomes" rows={3} value={s.expectedOutcomes} onChange={(e) => updateScope({ expectedOutcomes: e.target.value })} placeholder="Expected tangible outputs, capacity built, or business outcomes..." />
        </Field>
      </section>
    </div>
  );
}
