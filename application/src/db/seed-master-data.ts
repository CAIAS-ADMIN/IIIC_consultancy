import "dotenv/config";
import { db } from "./index";
import { masterData } from "./schema";

/**
 * Seeds the real dropdown option lists from
 * CAIAS_Consultancy_Online_System_Field_Dropdown_Structure.docx (sections 3,
 * 4, 5, 7). Idempotent: re-running upserts by (category, code).
 */
const ENTRIES: Array<{ category: string; code: string; label: string; sortOrder: number }> = [
  // Section 3 — Consultancy Area / Category
  ...[
    "Research & Technical",
    "Management Consultancy",
    "Business Consultancy",
    "Finance & Accounting",
    "Artificial Intelligence",
    "Data Analytics",
    "Information Technology",
    "Software / Application Development",
    "Technology / Engineering",
    "Innovation",
    "Design",
    "Training & Capacity Building",
    "Sustainability / ESG",
    "Academic Consultancy",
    "Industry Advisory",
    "Market Research",
    "Entrepreneurship / Startup",
    "Other",
  ].map((label, i) => ({ category: "consultancy_area", code: slug(label), label, sortOrder: i })),

  // Section 2 — Consultancy Type
  ...["Individual Faculty", "Department", "Consultancy Team", "Institutional"].map(
    (label, i) => ({ category: "consultancy_type", code: slug(label), label, sortOrder: i })
  ),

  // Section 6 — Team Type
  ...[
    "Single Faculty Member",
    "Faculty Team",
    "Inter-Departmental Team",
    "Department Team",
    "Institutional Consultancy Team",
    "Faculty + External Expert",
  ].map((label, i) => ({ category: "team_type", code: slug(label), label, sortOrder: i })),

  // Section 4 — Organization Type
  ...[
    "Private Company",
    "Public Company",
    "Government Department",
    "Government Agency",
    "Public Sector Organization",
    "NGO",
    "Academic Institution",
    "Research Institution",
    "Professional Organization",
    "Startup",
    "Enterprise",
    "International Organization",
    "Other",
  ].map((label, i) => ({ category: "organization_type", code: slug(label), label, sortOrder: i })),

  // Section 5 — Agreement Type
  ...["MoU", "Consultancy Agreement", "Work Order", "Service Agreement", "Other"].map(
    (label, i) => ({ category: "agreement_type", code: slug(label), label, sortOrder: i })
  ),

  // Section 7 — Payment Terms
  ...[
    "100% Advance",
    "100% Completion",
    "Advance + Final Payment",
    "Milestone Based",
    "Monthly",
    "Quarterly",
    "As per Agreement",
    "Other",
  ].map((label, i) => ({ category: "payment_terms", code: slug(label), label, sortOrder: i })),

  // Section 7 — Payment Mode
  ...["Bank Transfer", "NEFT", "RTGS", "IMPS", "Cheque", "Other"].map((label, i) => ({
    category: "payment_mode",
    code: slug(label),
    label,
    sortOrder: i,
  })),

  // Section 7 — Currency
  ...["INR", "USD", "EUR", "GBP", "Other"].map((label, i) => ({
    category: "currency",
    code: slug(label),
    label,
    sortOrder: i,
  })),

  // Section 21 — Document Type
  ...[
    "MoU",
    "Consultancy Agreement",
    "Work Order",
    "Service Agreement",
    "NDA",
    "IP Agreement",
    "Registration Document",
    "Project Proposal",
    "Scope of Work",
    "Milestone Document",
    "Progress Report",
    "Deliverable",
    "Invoice",
    "Payment Proof",
    "Client Acceptance",
    "Client Feedback",
    "Change/Variation Approval",
    "Extension Approval",
    "Renewal Document",
    "Closure Document",
    "Other",
  ].map((label, i) => ({ category: "document_type", code: slug(label), label, sortOrder: i })),
];

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/%/g, "pct")
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function main() {
  console.log(`Upserting ${ENTRIES.length} master-data rows...`);
  for (const entry of ENTRIES) {
    await db
      .insert(masterData)
      .values(entry)
      .onConflictDoUpdate({
        target: [masterData.category, masterData.code],
        set: { label: entry.label, sortOrder: entry.sortOrder },
      });
  }
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Master-data seed failed:", error);
    process.exit(1);
  });
