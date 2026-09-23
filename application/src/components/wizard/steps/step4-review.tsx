"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentCategoryPanel } from "@/components/documents/document-category-panel";
import { formatInr } from "@/lib/format";
import type { StepProps } from "../wizard-props";

function label(options: { code: string; label: string }[] | undefined, code: string): string {
  return options?.find((o) => o.code === code)?.label ?? (code || "—");
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value || "—"}</dd>
    </div>
  );
}

const RESOURCE_LABELS: Record<string, string> = {
  laboratoryRequired: "Laboratory",
  equipmentRequired: "Equipment",
  softwareRequired: "Software",
  travelRequired: "Travel",
  externalExpertRequired: "External Expert",
};

export function Step4Review({
  state,
  masterData,
  departments,
  draftId,
  signedAgreementUploaded,
  onSignedAgreementChange,
  submitError,
}: StepProps & {
  draftId: string | null;
  signedAgreementUploaded: boolean;
  onSignedAgreementChange: (uploaded: boolean) => void;
  submitError: string | null;
}) {
  const { consultancy: c, client, agreement: a, team: t, financial: f, scope: s, resources: r } = state;
  const departmentName = departments.find((d) => d.id === c.departmentId)?.name ?? "—";
  const activeResources = Object.entries(RESOURCE_LABELS).filter(([key]) => r[key as keyof typeof r]);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Client Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <ReviewRow label="Organization" value={client.organizationName} />
            <ReviewRow label="Type" value={label(masterData.organization_type, client.organizationTypeCode)} />
            <ReviewRow label="Contact" value={client.contactPersonName} />
            <ReviewRow label="Email" value={client.contactEmail} />
            <ReviewRow label="Phone" value={client.contactPhone} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consultancy Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <ReviewRow label="Title" value={c.title} />
            <ReviewRow label="Department" value={departmentName} />
            <ReviewRow label="Academic Year" value={label(masterData.academic_year, c.academicYearCode)} />
            <ReviewRow label="Consultancy Type" value={label(masterData.consultancy_type, c.consultancyTypeCode)} />
            <ReviewRow
              label="Consultancy Area"
              value={c.consultancyAreaCode === "other" ? c.consultancyAreaOther : label(masterData.consultancy_area, c.consultancyAreaCode)}
            />
            <ReviewRow label="Start Date" value={c.startDate} />
            <ReviewRow label="Expected Completion" value={c.expectedCompletionDate} />
            <ReviewRow label="NDA Required" value={r.ndaRequired ? "Yes" : "No"} />
            <ReviewRow label="IP Agreement Required" value={r.ipAgreementRequired ? "Yes" : "No"} />
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">{s.scopeOfWork}</p>
          <ul className="mt-2 list-inside list-disc text-sm text-foreground">
            {s.deliverables
              .filter((d) => d.description.trim() !== "")
              .map((d, i) => (
                <li key={i}>
                  {d.description}
                  {d.dueDate && <span className="text-muted-foreground"> — due {d.dueDate}</span>}
                </li>
              ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team &amp; Agreement</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="mb-3 flex flex-col gap-1 text-sm text-foreground">
            {t.members
              .filter((m) => m.name.trim() !== "")
              .map((m, i) => (
                <li key={i}>
                  {m.name} — {m.role}
                  {m.isExternal && <span className="text-muted-foreground"> (external)</span>}
                </li>
              ))}
          </ul>
          <dl>
            <ReviewRow label="Agreement Type" value={label(masterData.agreement_type, a.agreementTypeCode)} />
            <ReviewRow label="Agreement Value" value={a.agreementValue ? formatInr(Number(a.agreementValue)) : "—"} />
            <ReviewRow label="Payment Terms" value={label(masterData.payment_terms, a.paymentTermsCode)} />
            <ReviewRow label="Total Value" value={f.totalValue ? formatInr(Number(f.totalValue)) : "—"} />
            <ReviewRow label="Currency" value={f.currencyCode} />
            {activeResources.length > 0 && (
              <ReviewRow label="Resources" value={activeResources.map(([, l]) => l).join(", ")} />
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            A signed agreement must be on file before this consultancy can be submitted.
          </p>
          <DocumentCategoryPanel
            consultancyId={draftId}
            category="Signed Agreement"
            label="Signed Agreement"
            required
            onUploadedChange={onSignedAgreementChange}
          />
          {!signedAgreementUploaded && (
            <p className="text-xs text-muted-foreground">Required before this consultancy can be submitted.</p>
          )}
          {r.ndaRequired && (
            <DocumentCategoryPanel consultancyId={draftId} category="NDA" label="Non-Disclosure Agreement" />
          )}
          {r.ipAgreementRequired && (
            <DocumentCategoryPanel consultancyId={draftId} category="IP Agreement" label="IP Agreement" />
          )}
        </CardContent>
      </Card>

      {submitError && (
        <div className="rounded-lg border border-status-danger-bg bg-status-danger-bg/40 p-4 text-sm text-status-danger-fg">
          {submitError}
        </div>
      )}
    </div>
  );
}
