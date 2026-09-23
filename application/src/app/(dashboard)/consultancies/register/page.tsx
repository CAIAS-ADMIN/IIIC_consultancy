import Link from "next/link";
import { count, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { consultancies, closures } from "@/db/schema";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { BookMarked } from "lucide-react";

type RegisterRow = {
  consultancyId: string;
  consultancyCode: string | null;
  title: string;
  actualCompletionDate: string | null;
  finalOutcomes: string | null;
  deliverableCompletionStatus: string | null;
};

const COLUMNS: DataTableColumn<RegisterRow>[] = [
  {
    header: "Consultancy ID",
    primary: true,
    cell: (r) => (
      <Link href={`/consultancies/${r.consultancyId}`} className="font-medium text-foreground hover:underline">
        {r.consultancyCode ?? "—"}
      </Link>
    ),
  },
  { header: "Title", cell: (r) => r.title },
  { header: "Completed", cell: (r) => r.actualCompletionDate ?? "—" },
  { header: "Deliverables", cell: (r) => r.deliverableCompletionStatus ?? "—" },
  { header: "Outcomes", cell: (r) => r.finalOutcomes ?? "—" },
];

/** The Consultancy Register — auto-populated from closed records (same query the backend's `GET /api/consultancies/register` runs), never a manually maintained table. */
const PAGE_SIZE = 25;

export default async function ConsultancyRegisterPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const [{ total }] = await db.select({ total: count() }).from(consultancies).where(eq(consultancies.status, "completed_closed"));
  const page = parsePage((await searchParams).page, Math.ceil(total / PAGE_SIZE));

  const closedConsultancies = await db
    .select()
    .from(consultancies)
    .where(eq(consultancies.status, "completed_closed"))
    .orderBy(desc(consultancies.actualCompletionDate), desc(consultancies.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const closureRows =
    closedConsultancies.length > 0
      ? await db
          .select()
          .from(closures)
          .where(inArray(closures.consultancyId, closedConsultancies.map((c) => c.id)))
      : [];
  const finalClosureByConsultancy = new Map<string, (typeof closureRows)[number]>();
  for (const closure of closureRows) {
    if (closure.status === "verified") {
      finalClosureByConsultancy.set(closure.consultancyId, closure);
    }
  }

  const data: RegisterRow[] = closedConsultancies.map((c) => ({
    consultancyId: c.id,
    consultancyCode: c.consultancyCode,
    title: c.title,
    actualCompletionDate: c.actualCompletionDate,
    finalOutcomes: finalClosureByConsultancy.get(c.id)?.finalOutcomes ?? null,
    deliverableCompletionStatus: finalClosureByConsultancy.get(c.id)?.deliverableCompletionStatus ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Consultancy Register" subtitle="Auto-populated from every completed & closed consultancy." />
      <DataTable
        columns={COLUMNS}
        data={data}
        keyFor={(r) => r.consultancyId}
        emptyState={
          <EmptyState icon={BookMarked} title="No closed consultancies yet" description="Completed consultancies will appear here automatically." />
        }
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        hrefFor={(p) => (p > 1 ? `/consultancies/register?page=${p}` : "/consultancies/register")}
      />
    </div>
  );
}
