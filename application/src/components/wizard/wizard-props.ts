import type { WizardState } from "@/lib/wizard/types";
import type { StepErrors } from "@/lib/wizard/errors";
import type { MasterDataOption } from "./field";

export type MasterDataMap = Record<string, MasterDataOption[]>;

export type StepProps = {
  state: WizardState;
  errors: StepErrors;
  masterData: MasterDataMap;
  departments: { id: string; name: string }[];
  updateConsultancy: (patch: Partial<WizardState["consultancy"]>) => void;
  updateClient: (patch: Partial<WizardState["client"]>) => void;
  updateAgreement: (patch: Partial<WizardState["agreement"]>) => void;
  updateTeam: (patch: Partial<WizardState["team"]>) => void;
  updateFinancial: (patch: Partial<WizardState["financial"]>) => void;
  updateScope: (patch: Partial<WizardState["scope"]>) => void;
  updateResources: (patch: Partial<WizardState["resources"]>) => void;
};
