"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AGREEMENT_NOT_SIGNED_MESSAGE, AGREEMENT_SIGNED_OPTIONS } from "@/lib/validation/consultancy";
import { Field, MasterDataSelect, SectionHeading } from "../field";
import type { StepProps } from "../wizard-props";

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

export function Step1Preliminary({
  state,
  errors,
  masterData,
  departments,
  staff,
  principal,
  onBehalf,
  updateConsultancy,
  updateTeam,
}: StepProps) {
  const c = state.consultancy;
  const t = state.team;
  const departmentStaff = staff.filter((u) => u.departmentId === c.departmentId);
  const hod = departmentStaff.find((u) => u.roles.includes("hod"));

  const staffOptions = React.useMemo(
    () =>
      staff.map((u) => ({
        code: u.id,
        label: `${u.name}${u.employeeId ? ` (${u.employeeId})` : ""}${
          u.departmentId ? ` — ${departments.find((d) => d.id === u.departmentId)?.name ?? ""}` : ""
        }`,
      })),
    [staff, departments]
  );
  // An admin registering on someone's behalf picks the employee; the whole
  // form then carries that employee's details, never the admin's own.
  function handleFacultySelect(userId: string) {
    const selected = staff.find((u) => u.id === userId);
    if (!selected) return;

    const selectedDeptName = departments.find((d) => d.id === selected.departmentId)?.name ?? "";
    const updatedMembers = [...t.members];
    updatedMembers[0] = {
      ...updatedMembers[0],
      name: selected.name,
      employeeId: selected.employeeId ?? "",
      department: selectedDeptName,
      role: "principal_consultant",
    };

    updateTeam({ members: updatedMembers });
    updateConsultancy({
      facultyInChargeId: selected.id,
      ...(selected.departmentId && selected.departmentId !== c.departmentId
        ? { departmentId: selected.departmentId, departmentCoordinatorId: "" }
        : {}),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeading>Preliminary Requirement Check</SectionHeading>
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
            placeholder="Select signed agreement status"
          />
        </Field>
        {c.agreementSignedStatus === "no" && (
          <div role="status" className="flex gap-3 rounded-lg border border-status-warning-fg/30 bg-status-warning-bg p-4 text-sm text-status-warning-fg">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{AGREEMENT_NOT_SIGNED_MESSAGE}</p>
              <p className="mt-1 text-xs opacity-90">You may continue filling out the details and save your work as a Draft, but final registration submission requires an executed agreement.</p>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Institutional Details</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          {onBehalf && (
            <Field
              label="Faculty Consultant (registering on behalf of)"
              htmlFor="c-faculty-select"
              required
              error={errors.facultyInChargeId}
              className="sm:col-span-2"
            >
              <SearchableSelect
                id="c-faculty-select"
                options={staffOptions}
                value={c.facultyInChargeId}
                onChange={handleFacultySelect}
                placeholder="Select the employee this consultancy is for"
                searchPlaceholder="Search by name, employee ID or department…"
              />
            </Field>
          )}
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
          <ReadOnlyValue label="HOD / Department Head" value={hod?.name ?? "Auto-assigned"} />
        </div>

        <div className="mt-2 grid gap-4 rounded-lg border border-border bg-background p-4 sm:grid-cols-3">
          <ReadOnlyValue label="Faculty Consultant" value={principal.name} />
          <ReadOnlyValue label="Employee ID" value={principal.employeeId} />
          <ReadOnlyValue label="Department" value={principal.departmentName} />
        </div>
      </section>
    </div>
  );
}
