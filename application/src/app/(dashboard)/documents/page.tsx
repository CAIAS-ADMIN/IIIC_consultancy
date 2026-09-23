import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { consultancies } from "@/db/schema";
import { isOversightRole } from "@/components/shell/nav-config";
import { listDocumentsForConsultancy } from "@/db/queries/documents";
import { PageHeader } from "@/components/shell/page-header";
import { DocumentsHub } from "@/components/documents/documents-hub";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ consultancy?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const { consultancy: selectedId } = await searchParams;

  // Same "oversight roles see everything, faculty sees only their own" split
  // used by search/reports/export — but keyed on `facultyInChargeId`, not
  // department, since this hub is "my consultancies' documents," not a
  // department-wide browser (a faculty user with no department on record
  // still has their own consultancies' documents to manage).
  const rows = await db
    .select({
      id: consultancies.id,
      title: consultancies.title,
      consultancyCode: consultancies.consultancyCode,
      status: consultancies.status,
    })
    .from(consultancies)
    .where(isOversightRole(session.user.roles) ? undefined : eq(consultancies.facultyInChargeId, session.user.id))
    .orderBy(desc(consultancies.createdAt));

  const selected = selectedId && rows.some((r) => r.id === selectedId) ? selectedId : null;
  const existingCategories = selected ? [...new Set((await listDocumentsForConsultancy(selected)).map((d) => d.documentCategory))] : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Documents" subtitle="Upload, version, and download documents for a consultancy." />
      <DocumentsHub
        consultancies={rows}
        selectedId={selected}
        existingCategories={existingCategories}
      />
    </div>
  );
}
