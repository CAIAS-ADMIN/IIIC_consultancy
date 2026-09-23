"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Error boundary for every signed-in screen. It sits inside the app shell's
 * layout, so the sidebar/tab bar stay usable and the user can navigate away
 * instead of facing a blank page. Server-side error messages are replaced by
 * Next.js with a generic one in production; `digest` is the id that matches
 * the server log, shown so support can find it.
 */
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={AlertTriangle}
      title="Something went wrong loading this page"
      description={
        error.digest
          ? `Please try again. If it keeps happening, contact the IIIC office and quote reference ${error.digest}.`
          : "Please try again. If it keeps happening, contact the IIIC office."
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>Try again</Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      }
      className="mt-8"
    />
  );
}
