"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { pricesApi } from "@/lib/api";

interface PriceItem {
  symbol: string;
  price: number;
  change24h: number;
  displayName: string;
}

const CRYPTO_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
  ADA: "Cardano",
};

const CRYPTO_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  BNB: "#f3ba2f",
  SOL: "#00d4aa",
  ADA: "#0033ad",
};

const SYMBOLS = ["BTC", "ETH", "BNB", "SOL", "ADA"];

// Stable fallback prices — used when backend is down
const FALLBACK_PRICES: PriceItem[] = [
  { symbol: "BTC", displayName: "Bitcoin", price: 67500, change24h: 2.1 },
  { symbol: "ETH", displayName: "Ethereum", price: 3420, change24h: -0.8 },
  { symbol: "BNB", displayName: "BNB", price: 580, change24h: 1.4 },
  { symbol: "SOL", displayName: "Solana", price: 148, change24h: 5.3 },
  { symbol: "ADA", displayName: "Cardano", price: 0.61, change24h: -1.2 },
];

export default function LivePriceTicker() {
  const [prices, setPrices] = useState<PriceItem[]>(FALLBACK_PRICES);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchPrices = async () => {
    try {
      const data = await pricesApi.getRealtime(SYMBOLS);
      // Backend returns { symbol: { price, change_24h } } or similar
      const transformed: PriceItem[] = SYMBOLS.map((sym) => {
        const item = data?.[sym] || data?.find?.((d: any) => d.symbol === sym);
        return {
          symbol: sym,
          displayName: CRYPTO_NAMES[sym] || sym,
          price: parseFloat(item?.price || item?.current_price_usd || 0) || FALLBACK_PRICES.find(f => f.symbol === sym)!.price,
          change24h: parseFloat(item?.change_24h || item?.price_change_24h || 0) || FALLBACK_PRICES.find(f => f.symbol === sym)!.change24h,
        };
      });
      setPrices(transformed);
      setLastUpdated(new Date());
      setIsLive(true);
    } catch {
      // Silently use fallback
      setIsLive(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // Refresh prices every 15 seconds to ensure accuracy while avoiding rate limits
    const interval = setInterval(fetchPrices, 15000); 
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border-b border-gray-800/80">
      <div className="px-6 py-2 flex items-center gap-6 overflow-x-auto scrollbar-none">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-yellow-500"}`} />
          <span className="text-xs text-gray-500 font-medium">{isLive ? "LIVE" : "DEMO"}</span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-gray-700 shrink-0" />

        {/* Price items */}
        {prices.map((item) => {
          const isPos = item.change24h >= 0;
          return (
            <div key={item.symbol} className="flex items-center gap-2 shrink-0">
              {/* Colored dot */}
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CRYPTO_COLORS[item.symbol] || "#8b5cf6" }}
              />
              <span className="text-xs font-bold text-gray-300">{item.symbol}</span>
              <span className="text-xs font-mono text-white">{formatPrice(item.price)}</span>
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  isPos ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isPos ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {isPos ? "+" : ""}{item.change24h.toFixed(2)}%
              </span>
            </div>
          );
        })}

        {/* Last updated */}
        {lastUpdated && (
          <>
            <div className="h-4 w-px bg-gray-700 shrink-0 ml-auto" />
            <div className="flex items-center gap-1 shrink-0 text-gray-600 text-xs">
              <RefreshCw className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
