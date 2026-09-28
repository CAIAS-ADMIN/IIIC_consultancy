import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { canViewConsultancy } from "@/lib/consultancy/access";
import { isRecordKind } from "@/lib/records/model";
import { loadRecordDocument } from "@/lib/records/load";
import { renderRecordPdf } from "@/lib/records/pdf";

/**
 * GET /api/consultancies/:id/records/:kind — the Registration / Progress /
 * Closure record as a PDF with the CAIAS / IIIC letterhead, generated live
 * from the record (same content as the on-screen record page).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id, kind } = await params;
  if (!isRecordKind(kind)) {
    return Response.json({ error: "Unknown record type — use registration, progress or closure" }, { status: 404 });
  }

  const loaded = await loadRecordDocument(kind, id);
  if (!loaded || !(await canViewConsultancy(user, loaded.consultancy))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await renderRecordPdf(loaded.document);
  const name = `${(loaded.document.consultancyCode ?? "consultancy").replace(/[^A-Za-z0-9-]+/g, "-")}-${kind}-record.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
