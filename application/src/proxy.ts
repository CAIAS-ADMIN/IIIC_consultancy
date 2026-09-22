import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Gate for app/(dashboard)/** — a convenience redirect for unauthenticated
 * browser navigation. Not a security boundary: Server Actions run as their
 * own POST requests and can bypass this matcher, so every Server Action /
 * Route Handler must call requireRole itself (see lib/auth/requireRole.ts).
 */
export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  // Everything is treated as part of the authenticated app shell except the
  // public landing page, static assets, the auth/health API routes, and the
  // dev-only /style-guide route (already self-gated to non-production via
  // notFound() in the page itself — it has no backend dependency and
  // shouldn't require a Keycloak session just to preview components).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|style-guide|$).*)"],
};
