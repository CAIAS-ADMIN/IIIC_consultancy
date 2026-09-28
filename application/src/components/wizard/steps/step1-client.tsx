"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, MasterDataSelect, SectionHeading } from "../field";
import type { StepProps } from "../wizard-props";

export function Step1Client({ state, errors, masterData, updateClient }: StepProps) {
  const c = state.client;
  const isOther = c.organizationTypeCode === "other";

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeading>Client Information</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client Type" htmlFor="client-org-type" required error={errors.organizationTypeCode}>
            <MasterDataSelect
              id="client-org-type"
              options={masterData.organization_type ?? []}
              value={c.organizationTypeCode}
              onChange={(v) => updateClient({ organizationTypeCode: v })}
              placeholder="Select client type"
            />
          </Field>
          {isOther && (
            <Field label="Specify Client Type" htmlFor="client-org-type-other" required error={errors.organizationTypeOther}>
              <Input
                id="client-org-type-other"
                value={c.organizationTypeOther}
                onChange={(e) => updateClient({ organizationTypeOther: e.target.value })}
              />
            </Field>
          )}
          <Field label="Organisation Name" htmlFor="client-org-name" required error={errors.organizationName} className="sm:col-span-2">
            <Input
              id="client-org-name"
              value={c.organizationName}
              onChange={(e) => updateClient({ organizationName: e.target.value })}
              placeholder="e.g. Verdant Analytics Pvt Ltd"
            />
          </Field>
          <Field label="Client Industry / Sector" htmlFor="client-industry" required error={errors.industrySectorCode}>
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
          <Field label="GST Number" htmlFor="client-gst" error={errors.gstin}>
            <Input id="client-gst" value={c.gstin} maxLength={20} onChange={(e) => updateClient({ gstin: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="PAN / Registration Number" htmlFor="client-pan" error={errors.pan}>
            <Input id="client-pan" value={c.pan} maxLength={20} onChange={(e) => updateClient({ pan: e.target.value.toUpperCase() })} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Registered Address</SectionHeading>
        <Field label="Registered Address" htmlFor="client-address" required error={errors.address}>
          <Textarea id="client-address" rows={2} value={c.address} onChange={(e) => updateClient({ address: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="City" htmlFor="client-city" required error={errors.cityCode}>
            <Input id="client-city" value={c.cityCode} onChange={(e) => updateClient({ cityCode: e.target.value })} />
          </Field>
          <Field label="State" htmlFor="client-state" required error={errors.stateCode}>
            <Input id="client-state" value={c.stateCode} onChange={(e) => updateClient({ stateCode: e.target.value })} />
          </Field>
          <Field label="Country" htmlFor="client-country" required error={errors.countryCode}>
            <Input id="client-country" value={c.countryCode} onChange={(e) => updateClient({ countryCode: e.target.value })} />
          </Field>
          <Field label="PIN / Postal Code" htmlFor="client-pin" required error={errors.pinCode}>
            <Input id="client-pin" inputMode="numeric" value={c.pinCode} onChange={(e) => updateClient({ pinCode: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Authorised Contact</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="client-contact-name" required error={errors.contactPersonName}>
            <Input id="client-contact-name" value={c.contactPersonName} onChange={(e) => updateClient({ contactPersonName: e.target.value })} />
          </Field>
          <Field label="Designation" htmlFor="client-designation" required error={errors.designation}>
            <Input id="client-designation" value={c.designation} onChange={(e) => updateClient({ designation: e.target.value })} />
          </Field>
          <Field label="Official Email" htmlFor="client-email" required error={errors.contactEmail}>
            <Input id="client-email" type="email" value={c.contactEmail} onChange={(e) => updateClient({ contactEmail: e.target.value })} />
          </Field>
          <Field label="Mobile Number" htmlFor="client-phone" required error={errors.contactPhone}>
            <Input id="client-phone" type="tel" value={c.contactPhone} onChange={(e) => updateClient({ contactPhone: e.target.value })} />
          </Field>
          <Field label="Department / Division" htmlFor="client-contact-dept" error={errors.contactDepartment}>
            <Input id="client-contact-dept" value={c.contactDepartment} onChange={(e) => updateClient({ contactDepartment: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Alternate Contact (optional)</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Alternate Contact Person" htmlFor="client-alt-name" error={errors.alternateContactName}>
            <Input id="client-alt-name" value={c.alternateContactName} onChange={(e) => updateClient({ alternateContactName: e.target.value })} />
          </Field>
          <Field label="Alternate Email" htmlFor="client-alt-email" error={errors.alternateContactEmail}>
            <Input
              id="client-alt-email"
              type="email"
              value={c.alternateContactEmail}
              onChange={(e) => updateClient({ alternateContactEmail: e.target.value })}
            />
          </Field>
          <Field label="Alternate Mobile" htmlFor="client-alt-phone" error={errors.alternateContactPhone}>
            <Input
              id="client-alt-phone"
              type="tel"
              value={c.alternateContactPhone}
              onChange={(e) => updateClient({ alternateContactPhone: e.target.value })}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}
