"use client";

import { useEffect, useState } from "react";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunkErrorRecovery";

/**
 * Route-segment error boundary (Next.js App Router convention: catches
 * anything thrown by a page/layout below this one in the tree).
 *
 * Before this file existed, there was no error boundary anywhere in the app.
 * An uncaught error -- most commonly a stale-chunk 404 right after a
 * deploy/rebuild replaces the JS bundle a tab already has open -- unmounted
 * React with no fallback, freezing the screen on whatever was mid-render
 * (usually a loading spinner) with no way out except knowing to hard-refresh.
 *
 * Kept deliberately free of app UI component imports: if the bundle is
 * genuinely stale, importing another chunk-hashed module risks the same
 * failure this boundary exists to catch.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    console.error("Route error:", error);
    if (isChunkLoadError(error)) {
      setRecovering(true);
      recoverFromChunkError();
    }
  }, [error]);

  if (recovering) {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading the latest version…</p>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        This page hit an unexpected error. Reloading usually fixes it.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={() => reset()}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-medium"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="border-border rounded-lg border px-5 py-2.5 text-sm font-medium"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
