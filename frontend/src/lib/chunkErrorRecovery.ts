/**
 * Detects a stale-bundle error: the browser has an old page/router state open
 * and requests a JS chunk by a hash that no longer exists because the server
 * was redeployed (a new `next build` reassigns every chunk hash) since that
 * tab loaded. Webpack/Next surface this as "ChunkLoadError" or a dynamic
 * `import()` rejection, and it is NOT a code bug -- it cannot be caught or
 * prevented by application code, only recovered from.
 *
 * Without an error boundary at all, this exception was uncaught: React
 * unmounted mid-render and whatever was on screen at that instant (a loading
 * spinner, most often) stayed frozen forever, with no way for the user to
 * recover except knowing to hard-refresh -- which is exactly the "stuck on
 * the loading page" symptom this project kept hitting after every rebuild.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const signature = `${error.name} ${error.message}`.toLowerCase();
  return (
    signature.includes("chunkloaderror") ||
    signature.includes("loading chunk") ||
    signature.includes("failed to fetch dynamically imported module") ||
    signature.includes("importing a module script failed")
  );
}

const RELOAD_GUARD_KEY = "vaultx_chunk_reload_attempted";

/**
 * Reloads the tab once to pick up the current bundle. Guarded by
 * sessionStorage so a *genuinely* broken deploy (chunk still 404s after the
 * reload) shows the error fallback instead of reload-looping forever.
 */
export function recoverFromChunkError(): boolean {
  if (typeof window === "undefined") return false;
  if (window.sessionStorage.getItem(RELOAD_GUARD_KEY) === "1") return false;
  window.sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
  window.location.reload();
  return true;
}
