import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { SignInButton } from "@/components/shell/sign-in-button";
import { IIIC_LOGO_DATA_URI } from "@/components/shell/iiic-logo-data-uri";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
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
          <SignInButton />
        </CardContent>
      </Card>
    </div>
  );
}
