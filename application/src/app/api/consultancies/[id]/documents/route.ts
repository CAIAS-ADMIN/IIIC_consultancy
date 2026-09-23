import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/requireRole";
import { authErrorResponse } from "@/lib/auth/errors";
import { getConsultancyById } from "@/db/queries/consultancies";
import { listDocumentsForConsultancy } from "@/db/queries/documents";
import { canViewDocument } from "@/lib/documents/permissions";

/**
 * Lists every document (every category, every version) on record for a
 * consultancy — nothing else exposes this today; `GET /:id` only returns
 * client/agreement, and the only other document routes are presign/confirm
 * (write) and a single-document download. Needed for any UI to show version
 * history or "what's already uploaded" at all (Phase 4).
 *
 * Every row is returned regardless of the caller's access to it — `documents`
 * metadata (category, filename, uploader, version) isn't itself sensitive,
 * only the file contents are — but each row carries a server-computed
 * `viewerCanDownload` flag (the same `canViewDocument` rule `GET
 * /api/documents/:id/download` enforces) so a UI can show a locked/disabled
 * download affordance up front instead of only discovering a 403 on click.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSession();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  const consultancy = await getConsultancyById(id);
  if (!consultancy) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const category = request.nextUrl.searchParams.get("category") ?? undefined;
  const rows = await listDocumentsForConsultancy(id, category);

  const data = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      viewerCanDownload: await canViewDocument(user, consultancy, row.confidentialityLevel),
    }))
  );

  return Response.json({ data });
}
