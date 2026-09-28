import type { MasterLabels, RegistrationRecord } from "@/db/queries/registration-record";
import { registrationSections } from "@/lib/records/registration";
import { RecordSectionsView } from "@/components/records/record-view";

/**
 * The registration as captured by the wizard (portal spec Screens 3–14) —
 * the same sections as the Registration Record page and its PDF.
 */
export function RegistrationDetails({ record, showDeclaration = true }: { record: RegistrationRecord; showDeclaration?: boolean }) {
  return <RecordSectionsView sections={registrationSections(record, { showDeclaration, includeSignoff: false })} />;
}

export type { MasterLabels };
