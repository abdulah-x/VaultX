"use client";

import { useEffect, useState } from "react";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunkErrorRecovery";

/**
 * Root-layout error boundary. Next.js only invokes this (instead of
 * app/error.tsx) when the crash happens in the root layout itself rather than
 * a page below it -- rare, but that also means the layout's own providers
 * (theme, fonts, auth) cannot be trusted to still be working, so this must
 * render its own <html>/<body> and stay dependency-free. Plain inline styles
 * rather than Tailwind classes for the same reason: don't lean on anything
 * that could itself be part of what broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    console.error("Root layout error:", error);
    if (isChunkLoadError(error)) {
      setRecovering(true);
      recoverFromChunkError();
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0a0a0f",
          color: "#f5f5f7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        {recovering ? (
          <p style={{ color: "#a1a1aa", fontSize: 14 }}>Loading the latest version…</p>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
            <p style={{ color: "#a1a1aa", fontSize: 14, maxWidth: 420, margin: 0 }}>
              VaultX hit an unexpected error loading the page. Reloading usually fixes it.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                onClick={() => reset()}
                style={{
                  background: "#8b5cf6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "transparent",
                  color: "#f5f5f7",
                  border: "1px solid #2a2a35",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Reload page
              </button>
            </div>
          </>
        )}
      </body>
    </html>
  );
}
