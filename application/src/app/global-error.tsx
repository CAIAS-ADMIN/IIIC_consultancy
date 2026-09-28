"use client";

import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document (so the root layout's stylesheet import doesn't apply) —
 * it imports globals.css itself to keep using the design tokens.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="m-0 grid min-h-dvh place-items-center bg-background p-4 text-foreground">
        <main className="max-w-[420px] text-center">
          <h1 className="mb-2 text-xl font-bold">Something went wrong</h1>
          <p className="mb-5 text-[15px] text-muted-foreground">
            The portal couldn&apos;t load. Please try again.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="min-h-11 cursor-pointer rounded-sm bg-primary px-5 text-[15px] text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
