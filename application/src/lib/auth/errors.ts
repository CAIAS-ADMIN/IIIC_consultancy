import { UnauthorizedError, ForbiddenError } from "./requireRole";

/** Maps auth errors thrown by requireRole to the right HTTP response; rethrows anything else. */
export function authErrorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  throw error;
}
