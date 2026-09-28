"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * `signIn()` from next-auth/react works standalone as a client action — it
 * doesn't require a <SessionProvider> ancestor (only *reading* the session
 * via useSession() does), so this button needs nothing else wired up.
 */
export function SignInButton({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      onClick={() => signIn("keycloak", { callbackUrl })}
    >
      Sign in with Google
    </Button>
  );
}
