"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { IP_EXPECTED_OPTIONS } from "@/lib/validation/consultancy";
import { emptyResourceItem } from "@/lib/wizard/types";
import { CheckboxGroup, Field, RepeatingHeader, RepeatingRow, SectionHeading } from "../field";
import { patchRow, type StepProps } from "../wizard-props";

export function Step4ResourcesIp({ state, errors, masterData, updateResources }: StepProps) {
  const r = state.resources;
  const items = r.resourceItems;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeading>Institutional Resources</SectionHeading>
        <div className="flex flex-col gap-1.5">
          <Label>
            Will CAIAS resources be used?<span className="text-status-danger-fg"> *</span>
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
            <RepeatingHeader
              title="Resource Details"
              addLabel="Add Resource"
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
                <Field label="Resource" htmlFor={`res-name-${i}`} required error={errors[`resourceItems.${i}.resource`]}>
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
                <Field label="Cost, if applicable (₹)" htmlFor={`res-cost-${i}`}>
                  <Input
                    id={`res-cost-${i}`}
                    type="number"
                    min="0"
                    value={item.cost}
                    onChange={(e) => updateResources({ resourceItems: patchRow(items, i, { cost: e.target.value }) })}
                  />
                </Field>
              </RepeatingRow>
            ))}
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Intellectual Property</SectionHeading>
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
              <Field label="Supporting Clause / Agreement Reference" htmlFor="ip-clause">
                <Input id="ip-clause" value={r.ipClauseReference} onChange={(e) => updateResources({ ipClauseReference: e.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Upload the IP Agreement on the Review step.</p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Confidentiality</SectionHeading>
        <div className="flex flex-col gap-1.5">
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
            {r.ndaAvailable === "yes" && <p className="text-xs text-muted-foreground">Upload the NDA on the Review step.</p>}
            {r.ndaAvailable === "no" && (
              <Field label="How is confidentiality covered without an NDA?" htmlFor="conf-justification" required error={errors.confidentialityJustification}>
                <Textarea
                  id="conf-justification"
                  value={r.confidentialityJustification}
                  onChange={(e) => updateResources({ confidentialityJustification: e.target.value })}
                  placeholder="e.g. Confidentiality clause 7 of the consultancy agreement"
                />
              </Field>
            )}
          </>
        )}
      </section>
    </div>
  );
}
