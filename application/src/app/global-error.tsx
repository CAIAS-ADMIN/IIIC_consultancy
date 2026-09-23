"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document, so global CSS isn't available — styles are inline and
 * mirror the app's tokens (cream background, brand green).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f7f6f1", color: "#1a1f1a", fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#6b7075", margin: "0 0 20px", fontSize: 15 }}>
            The portal couldn&apos;t load. Please try again.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            onClick={() => retry()}
            style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 6, background: "#2e7d32", color: "#fff", fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
