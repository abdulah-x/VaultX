import { assetColor } from "@/types/portfolio";

/** Lettered monogram chip standing in for a token logo. Colour comes from the
 *  same assetColor map the dashboard charts use, so an asset is the same
 *  colour on the marketing page as it is inside the product. */
export default function AssetMark({ symbol, size = 32 }: { symbol: string; size?: number }) {
  const color = assetColor(symbol);
  return (
    <span
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "9999px",
        background: `${color}38`,
        color,
        border: "1px solid rgba(255,255,255,0.08)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: size * 0.34,
        letterSpacing: "-0.02em",
      }}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}
