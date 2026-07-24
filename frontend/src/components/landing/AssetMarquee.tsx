"use client";

import { assetColor } from "@/types/portfolio";

/**
 * A continuously scrolling strip of supported assets.
 *
 * Duplicated once and translated by exactly -50%, so the second copy lands
 * where the first began and the loop has no visible seam. The animation is
 * pure CSS on a transform, so it runs on the compositor and does not tie up
 * the main thread while the hero's WebGL canvas is also drawing.
 *
 * The whole strip is aria-hidden: it is decoration, and a screen reader
 * announcing a dozen ticker symbols on repeat is noise, not information.
 */

const ASSETS = [
  "BTC",
  "ETH",
  "BNB",
  "SOL",
  "ADA",
  "DOT",
  "AVAX",
  "LINK",
  "XRP",
  "LTC",
  "MATIC",
  "UNI",
];

function Row() {
  return (
    <>
      {ASSETS.map(symbol => (
        <div
          key={symbol}
          className="border-border/60 bg-card/50 flex shrink-0 items-center gap-2 rounded-full border px-4 py-2"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: assetColor(symbol) }}
          />
          <span className="text-muted-foreground text-sm font-semibold">{symbol}</span>
        </div>
      ))}
    </>
  );
}

export default function AssetMarquee() {
  return (
    <div
      aria-hidden
      className="relative flex overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
    >
      <div className="animate-marquee flex shrink-0 gap-3 pr-3">
        <Row />
        <Row />
      </div>
    </div>
  );
}
