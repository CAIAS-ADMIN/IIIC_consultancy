import type { WizardState } from "@/lib/wizard/types";
import type { StepErrors } from "@/lib/wizard/errors";
import type { MasterDataOption } from "./field";

export type MasterDataMap = Record<string, MasterDataOption[]>;

export type StaffMember = {
  id: string;
  name: string;
  departmentId: string | null;
  employeeId: string | null;
  email?: string | null;
  phone?: string | null;
  roles: string[];
};

/**
 * The faculty consultant the form is for — auto-populated institutional
 * details (Screen 3). The signed-in faculty member, or the employee an admin
 * picked when registering on their behalf.
 */
export type PrincipalInfo = {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  departmentId: string;
  departmentName: string;
};

export type StepProps = {
  state: WizardState;
  errors: StepErrors;
  masterData: MasterDataMap;
  departments: { id: string; name: string }[];
  staff: StaffMember[];
  principal: PrincipalInfo;
  /** True when an admin is filling the form on a faculty member's behalf (step 1 shows the employee picker). */
  onBehalf: boolean;
  updateConsultancy: (patch: Partial<WizardState["consultancy"]>) => void;
  updateClient: (patch: Partial<WizardState["client"]>) => void;
  updateAgreement: (patch: Partial<WizardState["agreement"]>) => void;
  updateTeam: (patch: Partial<WizardState["team"]>) => void;
  updateFinancial: (patch: Partial<WizardState["financial"]>) => void;
  updateScope: (patch: Partial<WizardState["scope"]>) => void;
  updateTimeline: (patch: Partial<WizardState["timeline"]>) => void;
  updateResources: (patch: Partial<WizardState["resources"]>) => void;
  updateDeclaration: (patch: Partial<WizardState["declaration"]>) => void;
};

/** Replace one row of a repeating section immutably. */
export function patchRow<T>(rows: T[], index: number, patch: Partial<T>): T[] {
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}
