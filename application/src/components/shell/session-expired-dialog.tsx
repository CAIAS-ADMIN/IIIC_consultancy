"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SESSION_EXPIRED_EVENT = "caias:session-expired";

/**
 * Call when an API request comes back 401 mid-session (the 8-hour session
 * `maxAge` ran out while the tab stayed open). Opens the re-sign-in prompt
 * instead of leaving the user staring at a raw error.
 */
export function notifySessionExpired() {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

/**
 * Mounted once in the app shell. Dismissible on purpose — a user mid-way
 * through a form can close it, copy what they typed, then sign in again.
 */
export function SessionExpiredDialog() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, show);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, show);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your session has expired</DialogTitle>
          <DialogDescription>
            For security, sessions end after 8 hours. Sign in again to continue — you&apos;ll come back to this page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => signIn("keycloak", { callbackUrl: `${window.location.pathname}${window.location.search}` })}
          >
            Sign in again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
