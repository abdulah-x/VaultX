"use client";

import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useMarketTickers } from "@/hooks/queries";
import { TrendingUp, TrendingDown, RefreshCw, Search, AlertCircle } from "lucide-react";

/**
 * The markets list is driven entirely by the API now.
 *
 * It previously kept a FALLBACK_MARKETS table of ten hardcoded prices and used
 * it as the base of every row, overlaying live values on top. Because the
 * lookup key was wrong, the overlay never matched and the page rendered those
 * hardcoded numbers -- with a green "Live" badge above them. Pairs that the
 * exchange does not return are now simply absent from the table.
 */
const PAIRS = [
  { pair: "BTCUSDT", symbol: "BTC", name: "Bitcoin", color: "#f7931a" },
  { pair: "ETHUSDT", symbol: "ETH", name: "Ethereum", color: "#627eea" },
  { pair: "BNBUSDT", symbol: "BNB", name: "BNB", color: "#f3ba2f" },
  { pair: "SOLUSDT", symbol: "SOL", name: "Solana", color: "#00d4aa" },
  { pair: "ADAUSDT", symbol: "ADA", name: "Cardano", color: "#0033ad" },
  { pair: "DOTUSDT", symbol: "DOT", name: "Polkadot", color: "#e6007a" },
  { pair: "AVAXUSDT", symbol: "AVAX", name: "Avalanche", color: "#e84142" },
  { pair: "LINKUSDT", symbol: "LINK", name: "Chainlink", color: "#2a5ada" },
  { pair: "XRPUSDT", symbol: "XRP", name: "Ripple", color: "#00aae4" },
  { pair: "LTCUSDT", symbol: "LTC", name: "Litecoin", color: "#bfbbbb" },
];

type SortKey = "symbol" | "price" | "changePercent" | "quoteVolume";

const formatPrice = (p: number) =>
  p >= 1000
    ? `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : p >= 1
      ? `$${p.toFixed(2)}`
      : `$${p.toFixed(4)}`;

const formatVolume = (v?: number) => {
  if (!v || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export default function MarketsPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("changePercent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useMarketTickers(
    PAIRS.map(p => p.pair)
  );

  const meta = (pair: string) => PAIRS.find(p => p.pair === pair);

  const rows = (data ?? []).map(ticker => {
    const info = meta(ticker.symbol);
    return {
      ...ticker,
      displaySymbol: info?.symbol ?? ticker.symbol,
      name: info?.name ?? ticker.symbol,
      color: info?.color ?? "#8b5cf6",
    };
  });

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const filtered = rows
    .filter(
      m =>
        m.displaySymbol.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortBy === "symbol") return mul * a.displaySymbol.localeCompare(b.displaySymbol);
      if (sortBy === "price") return mul * (a.price - b.price);
      if (sortBy === "quoteVolume") return mul * (a.quoteVolume - b.quoteVolume);
      return mul * (a.changePercent - b.changePercent);
    });

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className={`ml-1 text-xs ${sortBy === col ? "text-primary" : "text-muted-foreground"}`}>
      {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "▸"}
    </span>
  );

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          {/* Header */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-foreground text-3xl font-bold">Markets Overview</h1>
              <p className="text-muted-foreground mt-1">
                Live 24h prices, sourced from the exchange
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg p-2 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border py-2.5 pr-4 pl-10 text-sm transition-colors focus:outline-none"
            />
          </div>

          {/* Table */}
          <div className="bg-secondary border-border overflow-hidden rounded-2xl border">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="border-primary h-10 w-10 animate-spin rounded-full border-b-2" />
              </div>
            ) : isError || rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <AlertCircle className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  Market data is unavailable right now.
                </p>
                <button
                  onClick={() => refetch()}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-border bg-card border-b">
                      <th className="px-6 py-4 text-left">
                        <button
                          onClick={() => handleSort("symbol")}
                          className="text-muted-foreground hover:text-foreground text-xs font-semibold tracking-wider uppercase transition-colors"
                        >
                          Asset <SortIcon col="symbol" />
                        </button>
                      </th>
                      <th className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleSort("price")}
                          className="text-muted-foreground hover:text-foreground text-xs font-semibold tracking-wider uppercase transition-colors"
                        >
                          Price <SortIcon col="price" />
                        </button>
                      </th>
                      <th className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleSort("changePercent")}
                          className="text-muted-foreground hover:text-foreground text-xs font-semibold tracking-wider uppercase transition-colors"
                        >
                          24h Change <SortIcon col="changePercent" />
                        </button>
                      </th>
                      <th className="hidden px-6 py-4 text-right md:table-cell">
                        <button
                          onClick={() => handleSort("quoteVolume")}
                          className="text-muted-foreground hover:text-foreground text-xs font-semibold tracking-wider uppercase transition-colors"
                        >
                          24h Volume <SortIcon col="quoteVolume" />
                        </button>
                      </th>
                      <th className="hidden px-6 py-4 text-right lg:table-cell">
                        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          24h Range
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {filtered.map((asset, idx) => {
                      const isPos = asset.changePercent >= 0;
                      return (
                        <tr
                          key={asset.symbol}
                          className="hover:bg-secondary/60 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground w-5 text-right text-sm">
                                {idx + 1}
                              </span>
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                                style={{
                                  backgroundColor: asset.color + "33",
                                  border: `1px solid ${asset.color}55`,
                                }}
                              >
                                <span style={{ color: asset.color }}>
                                  {asset.displaySymbol.slice(0, 3)}
                                </span>
                              </div>
                              <div>
                                <div className="text-foreground text-sm font-semibold">
                                  {asset.displaySymbol}
                                </div>
                                <div className="text-muted-foreground text-xs">{asset.name}</div>
                              </div>
                            </div>
                          </td>

                          <td className="text-foreground px-6 py-4 text-right font-mono font-semibold tabular-nums">
                            {formatPrice(asset.price)}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums ${
                                isPos
                                  ? "bg-vaultx-success/20 text-vaultx-success"
                                  : "bg-vaultx-danger/20 text-vaultx-danger"
                              }`}
                            >
                              {isPos ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {isPos ? "+" : ""}
                              {asset.changePercent.toFixed(2)}%
                            </span>
                          </td>

                          <td className="text-muted-foreground hidden px-6 py-4 text-right font-mono text-sm tabular-nums md:table-cell">
                            {formatVolume(asset.quoteVolume)}
                          </td>

                          <td className="text-muted-foreground hidden px-6 py-4 text-right font-mono text-xs tabular-nums lg:table-cell">
                            {formatPrice(asset.low)} – {formatPrice(asset.high)}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-muted-foreground px-6 py-12 text-center">
                          No assets matching &ldquo;{search}&rdquo;
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {dataUpdatedAt > 0 && rows.length > 0 && (
              <div className="border-border text-muted-foreground border-t px-6 py-3 text-right text-xs">
                Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()} · Auto-refreshes every
                30s
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
