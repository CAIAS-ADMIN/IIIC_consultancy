import Link from "next/link";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/closure/print-button";
import type { RecordKind } from "@/lib/records/model";

/** Link that downloads a record's letterhead PDF. */
export function DownloadRecordPdfButton({
  consultancyId,
  kind,
  label = "Download PDF",
  variant = "primary",
}: {
  consultancyId: string;
  kind: RecordKind;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Button asChild variant={variant} className="gap-1.5">
      <a href={`/api/consultancies/${consultancyId}/records/${kind}`} download>
        <FileDown className="h-4 w-4" aria-hidden />
        {label}
      </a>
    </Button>
  );
}

/** The bar above a record page: back link, Print, and Download PDF. */
export function RecordPageActions({ consultancyId, kind }: { consultancyId: string; kind: RecordKind }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link href={`/consultancies/${consultancyId}`} className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">
        ← Back to consultancy
      </Link>
      <div className="flex flex-wrap gap-2">
        <PrintButton />
        <DownloadRecordPdfButton consultancyId={consultancyId} kind={kind} />
      </div>
    </div>
  );
}
