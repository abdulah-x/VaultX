/**
 * Display formatting for values coming off the API.
 *
 * The backend stores money as DECIMAL(20,8) and serializes it as a *string* to
 * avoid the precision loss a JSON number would introduce -- so
 * `total_portfolio_value_usd` arrives as "32389.2930000000000000", not 32389.29.
 *
 * That distinction caused two separate bugs before this module existed:
 *   - `value.toLocaleString()` on a string is a silent no-op (String inherits
 *     its own toLocaleString), so raw 16-decimal values were rendered verbatim.
 *   - `value.toFixed(2)` on a string throws TypeError, which took the dashboard
 *     down the moment a real portfolio response arrived.
 *
 * Everything here therefore accepts `unknown` and coerces once, at the edge.
 */

/** Coerce an API value to a finite number, or `fallback` if it isn't one. */
export function toNum(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** True when the API actually sent a usable number, as opposed to null/absent. */
export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(typeof value === "number" ? value : Number(value));
}

/** "$32,389.29" -- currency with a fixed 2dp, safe on strings and numbers. */
export function usd(value: unknown, fractionDigits = 2): string {
  const n = toNum(value);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** "+$1,262.50" / "-$345.88" -- currency carrying an explicit sign. */
export function signedUsd(value: unknown, fractionDigits = 2): string {
  const n = toNum(value);
  return `${n >= 0 ? "+" : "-"}${usd(Math.abs(n), fractionDigits)}`;
}

/** "$1.2M" / "$8.4K" / "$412.30" -- for headline figures where width matters. */
export function compactUsd(value: unknown): string {
  const n = toNum(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${usd(abs)}`;
}

/** "-4.23%" -- the API sends full precision, we show two decimals. */
export function pct(value: unknown, fractionDigits = 2): string {
  return `${toNum(value).toFixed(fractionDigits)}%`;
}

/** "+15.86%" -- percentage carrying an explicit sign. */
export function signedPct(value: unknown, fractionDigits = 2): string {
  const n = toNum(value);
  return `${n >= 0 ? "+" : ""}${n.toFixed(fractionDigits)}%`;
}

/**
 * Asset quantities need more precision than money: 0.3 BTC and 1000 ADA are
 * both legitimate, so a fixed decimal count either truncates one or pads the
 * other with noise.
 */
export function qty(value: unknown): string {
  const n = toNum(value);
  const abs = Math.abs(n);
  const digits = abs === 0 ? 2 : abs < 1 ? 6 : abs < 1000 ? 4 : 2;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** True when the value is at or above zero -- drives the gain/loss colouring. */
export function isPositive(value: unknown): boolean {
  return toNum(value) >= 0;
}
