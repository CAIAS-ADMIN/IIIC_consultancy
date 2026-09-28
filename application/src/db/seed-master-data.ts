import "dotenv/config";
import { db } from "./index";
import { masterData } from "./schema";
import { getCurrentAcademicYearCode } from "../lib/academic-year";

/**
 * Seeds the real dropdown option lists from
 * CAIAS_Consultancy_Online_System_Field_Dropdown_Structure.docx (sections 3,
 * 4, 5, 7). Idempotent: re-running upserts by (category, code).
 */
const ENTRIES: Array<{
  category: string;
  code: string;
  label: string;
  sortOrder: number;
  metadata?: { current: boolean };
}> = [
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
  ...["Individual Faculty", "Department", "Consultancy Team", "Institutional", "Other"].map(
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
    "Public Sector Undertaking",
    "Individual / Professional",
    "Other",
  ].map((label, i) => ({ category: "organization_type", code: slug(label), label, sortOrder: i })),

  // Section 5 — Agreement Type
  ...["MoU", "Consultancy Agreement", "Work Order", "Service Agreement", "Letter of Engagement", "Other"].map(
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

  // Portal spec v2 (CAIAS_Consultancy_Portal_Updated_v2.docx) — dropdowns
  // that the field/dropdown doc didn't have. Codes are slugs of the labels,
  // same as every other category here.
  // Screen 5 — Nature of Consultancy
  ...[
    "Advisory / Expert Consultation",
    "Training / Capacity Building",
    "Technical Consultancy",
    "Business Consultancy",
    "Management Consultancy",
    "IT / Software Consultancy",
    "Data / Analytics Consultancy",
    "Testing / Analysis",
    "Design / Development",
    "Feasibility Study",
    "Audit / Assessment",
    "Documentation / Report Preparation",
    "Social / Community Consultancy",
    "Research-based Consultancy",
    "Other",
  ].map((label, i) => ({ category: "nature_of_consultancy", code: slug(label), label, sortOrder: i })),

  // Screen 5 — Consultancy Domain (multi-select)
  ...[
    "Management",
    "Commerce",
    "Finance",
    "Computer Science / IT",
    "Data Science / AI",
    "Science",
    "Arts / Humanities",
    "Social Sciences",
    "Education",
    "Sustainability",
    "Entrepreneurship",
    "Marketing",
    "HR",
    "Operations",
    "Other",
  ].map((label, i) => ({ category: "consultancy_domain", code: slug(label), label, sortOrder: i })),

  // Screen 5 — Consultancy Category
  ...["Expertise Intensive", "Infrastructure Intensive", "Expertise + Infrastructure", "Multidisciplinary"].map(
    (label, i) => ({ category: "consultancy_category", code: slug(label), label, sortOrder: i })
  ),

  // Screen 8 — Role in Consultancy
  ...[
    "Principal Consultant",
    "Co-Consultant",
    "Technical Expert",
    "Subject Matter Expert",
    "Project Coordinator",
    "Research Support",
    "Administrative Support",
    "Other",
  ].map((label, i) => ({ category: "team_role", code: slug(label), label, sortOrder: i })),

  // Screen 11 — Institutional Resources
  ...[
    "Laboratory",
    "Computer Systems",
    "Software",
    "Equipment",
    "Classroom",
    "Auditorium",
    "Meeting Room",
    "Innovation / Incubation Facility",
    "Library / Database",
    "Data / Computing Resources",
    "Travel",
    "Other",
  ].map((label, i) => ({ category: "resource_type", code: slug(label), label, sortOrder: i })),

  // Screen 12 — IP Type
  ...[
    "Patent",
    "Copyright",
    "Trademark",
    "Design",
    "Software",
    "Database",
    "Know-how",
    "Technical Documentation",
    "Other",
  ].map((label, i) => ({ category: "ip_type", code: slug(label), label, sortOrder: i })),

  // Section 53 — Reporting Frequency
  ...["Monthly", "Quarterly", "Milestone-based", "Custom"].map((label, i) => ({
    category: "reporting_frequency",
    code: slug(label),
    label,
    sortOrder: i,
  })),

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

  // Academic Year — not a docx-sourced dropdown list (the docx doesn't name
  // one), but `consultancies.academic_year_code` is free text on every
  // record and the frontend build plan expects it to be admin-manageable
  // master data like every other dropdown. Code/label are both the
  // "YYYY-YY" string already used on existing records (e.g. "2025-26").
  // Range includes a few years back plus one ahead (so a wizard can plan a
  // consultancy starting next year) — which means sort order alone can't
  // mark "current" (the row seeded last, "current+1", would always win).
  // Instead the one row matching today's date gets `metadata.current: true`
  // at seed time (see `getCurrentAcademicYear`'s DB-first lookup) — re-running
  // this seed script in a later year correctly moves the flag forward.
  ...academicYearRange(2023, 2029).map((label, i) => ({
    category: "academic_year",
    code: label,
    label,
    sortOrder: i,
    metadata: { current: label === getCurrentAcademicYearCode() },
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

/** ["2023-24", "2024-25", ..., "2028-29"] — inclusive of `startYear`, exclusive of `endYearExclusive`. */
function academicYearRange(startYear: number, endYearExclusive: number): string[] {
  return Array.from({ length: endYearExclusive - startYear }, (_, i) => {
    const year = startYear + i;
    return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  });
}

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
        set: { label: entry.label, sortOrder: entry.sortOrder, metadata: entry.metadata ?? null },
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
