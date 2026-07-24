"use client";

import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { useMarketTickers } from "@/hooks/queries";
import { assetColor } from "@/types/portfolio";

/**
 * Trading pairs, and the bare asset symbol shown in the strip. The API is
 * addressed by pair (BTCUSDT); the previous version passed bare symbols and
 * then read the response back by bare symbol too, so every lookup missed and
 * the strip silently rendered a hardcoded price table while displaying "LIVE".
 */
const PAIRS = [
  { pair: "BTCUSDT", symbol: "BTC" },
  { pair: "ETHUSDT", symbol: "ETH" },
  { pair: "BNBUSDT", symbol: "BNB" },
  { pair: "SOLUSDT", symbol: "SOL" },
  { pair: "ADAUSDT", symbol: "ADA" },
];

const formatPrice = (price: number) => {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
};

export default function LivePriceTicker() {
  const { data, isLoading, isError, dataUpdatedAt } = useMarketTickers(PAIRS.map(p => p.pair));

  const tickers = data ?? [];
  const isLive = !isError && tickers.length > 0;

  // No placeholder prices. Showing invented numbers on a market ticker is worse
  // than showing nothing -- they are indistinguishable from real quotes.
  if (!isLive) {
    return (
      <div className="bg-card border-border border-b">
        <div className="flex items-center gap-2 px-6 py-2">
          <div className="bg-vaultx-warning h-1.5 w-1.5 rounded-full" />
          <span className="text-muted-foreground text-xs font-medium">
            {isLoading ? "Loading market prices…" : "Market prices unavailable"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-border border-b">
      <div className="scrollbar-none flex items-center gap-6 overflow-x-auto px-6 py-2">
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="bg-vaultx-success h-1.5 w-1.5 animate-pulse rounded-full" />
          <span className="text-muted-foreground text-xs font-medium">LIVE</span>
        </div>

        <div className="bg-border h-4 w-px shrink-0" />

        {tickers.map(ticker => {
          const label = PAIRS.find(p => p.pair === ticker.symbol)?.symbol ?? ticker.symbol;
          const isPos = ticker.changePercent >= 0;
          return (
            <div key={ticker.symbol} className="flex shrink-0 items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: assetColor(label) }}
              />
              <span className="text-muted-foreground text-xs font-bold">{label}</span>
              <span className="text-foreground font-mono text-xs tabular-nums">
                {formatPrice(ticker.price)}
              </span>
              <span
                className={`flex items-center gap-0.5 text-xs font-medium tabular-nums ${
                  isPos ? "text-vaultx-success" : "text-vaultx-danger"
                }`}
              >
                {isPos ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {isPos ? "+" : ""}
                {ticker.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}

        {dataUpdatedAt > 0 && (
          <>
            <div className="bg-border ml-auto h-4 w-px shrink-0" />
            <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              {new Date(dataUpdatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
