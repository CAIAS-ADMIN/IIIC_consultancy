import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { SignInButton } from "@/components/shell/sign-in-button";
import { IIIC_LOGO_DATA_URI } from "@/components/shell/iiic-logo-data-uri";

/**
 * Auth.js passes `callbackUrl` back as an absolute URL. Only its path is
 * kept, so the result is always same-origin — never an open redirect
 * (`//evil.example/x` becomes `/x`).
 */
function safeCallbackPath(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "http://placeholder.invalid");
    const path = `${url.pathname}${url.search}`;
    return path === "/" ? null : path;
  } catch {
    return null;
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const returnTo = safeCallbackPath(callbackUrl);

  const session = await auth();
  if (session?.user) {
    redirect(returnTo ?? "/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- inlined as a
              data URI on purpose: this is the one page that renders for a
              signed-out visitor, and proxy.ts's matcher (which we must not
              touch) redirects every unauthenticated request — including
              /brand/* public assets — to /api/auth/signin, so a normal
              network-fetched <Image>/<img src="/brand/..."> 404s/redirects
              here. Everywhere else in the app (post-auth) uses the real file. */}
          <img src={IIIC_LOGO_DATA_URI} alt="IIIC logo" width={64} height={64} />
          <div>
            <h1 className="text-xl font-bold text-foreground">IIIC Consultancy Portal</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to register, track, and manage consultancy engagements.
            </p>
          </div>
          {returnTo && (
            <p role="status" className="w-full rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">
              You&apos;re signed out — sessions end after 8 hours. Sign in to continue where you left off.
            </p>
          )}
          <SignInButton callbackUrl={returnTo ?? "/dashboard"} />
        </CardContent>
      </Card>
    </div>
  );
}
