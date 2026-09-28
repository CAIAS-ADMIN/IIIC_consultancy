import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { canViewConsultancy } from "@/lib/consultancy/access";
import { loadRecordDocument } from "@/lib/records/load";
import type { RecordKind } from "@/lib/records/model";
import { RecordDocumentView } from "./record-view";
import { RecordPageActions } from "./record-actions";

/**
 * A printable record page (Registration / Progress / Closure) — the same
 * content as its downloadable PDF, with the letterhead on top.
 */
export async function RecordPage({ kind, consultancyId }: { kind: RecordKind; consultancyId: string }) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const loaded = await loadRecordDocument(kind, consultancyId);
  if (!loaded) notFound();
  const viewer = { ...session.user, name: session.user.name ?? null, email: session.user.email ?? null };
  if (!(await canViewConsultancy(viewer, loaded.consultancy))) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 print:max-w-none">
      <RecordPageActions consultancyId={consultancyId} kind={kind} />
      <RecordDocumentView record={loaded.document} />
    </div>
  );
}
