"use client";

import { Input } from "@/components/ui/input";
import { Field, MasterDataSelect } from "../field";
import type { StepProps } from "../wizard-props";

export function Step1Client({ state, errors, masterData, updateClient }: StepProps) {
  const c = state.client;
  const isOther = c.organizationTypeCode === "other";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization Name" htmlFor="client-org-name" required error={errors.organizationName}>
          <Input
            id="client-org-name"
            value={c.organizationName}
            onChange={(e) => updateClient({ organizationName: e.target.value })}
            placeholder="e.g. Verdant Analytics Pvt Ltd"
          />
        </Field>
        <Field label="Organization Type" htmlFor="client-org-type" required error={errors.organizationTypeCode}>
          <MasterDataSelect
            id="client-org-type"
            options={masterData.organization_type ?? []}
            value={c.organizationTypeCode}
            onChange={(v) => updateClient({ organizationTypeCode: v })}
            placeholder="Select organization type"
          />
        </Field>
        {isOther && (
          <Field
            label="Specify Organization Type"
            htmlFor="client-org-type-other"
            required
            error={errors.organizationTypeOther}
            className="sm:col-span-2"
          >
            <Input
              id="client-org-type-other"
              value={c.organizationTypeOther}
              onChange={(e) => updateClient({ organizationTypeOther: e.target.value })}
            />
          </Field>
        )}
        <Field label="Industry / Sector" htmlFor="client-industry" error={errors.industrySectorCode}>
          <Input
            id="client-industry"
            value={c.industrySectorCode}
            onChange={(e) => updateClient({ industrySectorCode: e.target.value })}
            placeholder="e.g. Manufacturing"
          />
        </Field>
        <Field label="Website" htmlFor="client-website" error={errors.website}>
          <Input
            id="client-website"
            type="url"
            value={c.website}
            onChange={(e) => updateClient({ website: e.target.value })}
            placeholder="https://"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact Person Name" htmlFor="client-contact-name" error={errors.contactPersonName}>
          <Input
            id="client-contact-name"
            value={c.contactPersonName}
            onChange={(e) => updateClient({ contactPersonName: e.target.value })}
          />
        </Field>
        <Field label="Designation" htmlFor="client-designation" error={errors.designation}>
          <Input
            id="client-designation"
            value={c.designation}
            onChange={(e) => updateClient({ designation: e.target.value })}
          />
        </Field>
        <Field label="Contact Email" htmlFor="client-email" error={errors.contactEmail}>
          <Input
            id="client-email"
            type="email"
            value={c.contactEmail}
            onChange={(e) => updateClient({ contactEmail: e.target.value })}
          />
        </Field>
        <Field label="Contact Phone" htmlFor="client-phone" error={errors.contactPhone}>
          <Input
            id="client-phone"
            type="tel"
            value={c.contactPhone}
            onChange={(e) => updateClient({ contactPhone: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Address" htmlFor="client-address" error={errors.address}>
        <Input
          id="client-address"
          value={c.address}
          onChange={(e) => updateClient({ address: e.target.value })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Country" htmlFor="client-country" error={errors.countryCode}>
          <Input id="client-country" value={c.countryCode} onChange={(e) => updateClient({ countryCode: e.target.value })} />
        </Field>
        <Field label="State" htmlFor="client-state" error={errors.stateCode}>
          <Input id="client-state" value={c.stateCode} onChange={(e) => updateClient({ stateCode: e.target.value })} />
        </Field>
        <Field label="City" htmlFor="client-city" error={errors.cityCode}>
          <Input id="client-city" value={c.cityCode} onChange={(e) => updateClient({ cityCode: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
