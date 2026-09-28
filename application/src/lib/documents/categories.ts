/**
 * Portal spec §24 — the central document repository's categories, grouped.
 * Registration-time categories (Signed Agreement, Scope of Work, NDA…) are
 * the ones the wizard's checklist uploads into.
 */
export const DOCUMENT_REPOSITORY_GROUPS: { group: string; categories: string[] }[] = [
  {
    group: "Agreement",
    categories: [
      "Signed Agreement",
      "MoU",
      "Consultancy Agreement",
      "Work Order",
      "NDA",
      "IP Agreement",
      "Scope of Work",
      "Client Letter",
      "Technical Proposal",
      "Financial Proposal",
      "Resource Approval",
      "External Expert Document",
    ],
  },
  { group: "Execution", categories: ["Progress Report", "Meeting Minutes", "Deliverable", "Technical Document", "Client Communication"] },
  { group: "Financial", categories: ["Payment Record", "Invoice", "Receipt"] },
  {
    group: "Closure",
    categories: ["Final Report", "Final Technical Report", "Client Acceptance", "Client Feedback", "Closure Form", "Photographs", "Presentation", "Outcome Evidence"],
  },
];

export const OTHER_DOCUMENT_GROUP = "Other";

/** Which repository group a category belongs to ("Other" for free-text categories). */
export function documentGroupFor(category: string): string {
  return DOCUMENT_REPOSITORY_GROUPS.find((g) => g.categories.includes(category))?.group ?? OTHER_DOCUMENT_GROUP;
}
