"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { tradesApi } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";

interface Trade {
  id: number;
  symbol: string;
  base_asset?: string;
  quote_asset?: string;
  side: string;
  quantity: number;
  price: number;
  total?: number;
  realized_pnl_usd?: number;
  executed_at: string;
  status?: string;
  fee_usd?: number;
}

const SIDE_FILTER = ["ALL", "BUY", "SELL"] as const;
type SideFilter = (typeof SIDE_FILTER)[number];

// Fallback mock trades
function generateMockTrades(): Trade[] {
  const pairs = [
    { symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT", price: 67500 },
    { symbol: "ETHUSDT", base_asset: "ETH", quote_asset: "USDT", price: 3420 },
    { symbol: "SOLUSDT", base_asset: "SOL", quote_asset: "USDT", price: 148 },
    { symbol: "ADAUSDT", base_asset: "ADA", quote_asset: "USDT", price: 0.61 },
    { symbol: "BNBUSDT", base_asset: "BNB", quote_asset: "USDT", price: 580 },
  ];
  return Array.from({ length: 20 }, (_, i) => {
    const pair = pairs[i % pairs.length];
    const side = i % 3 === 0 ? "SELL" : "BUY";
    const qty = parseFloat((Math.random() * 2 + 0.01).toFixed(4));
    const price = pair.price * (1 + (Math.random() - 0.5) * 0.04);
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      id: i + 1,
      symbol: pair.symbol,
      base_asset: pair.base_asset,
      quote_asset: pair.quote_asset,
      side,
      quantity: qty,
      price: parseFloat(price.toFixed(2)),
      total: qty * price,
      realized_pnl_usd: side === "SELL" ? parseFloat(((Math.random() - 0.3) * qty * price * 0.05).toFixed(2)) : undefined,
      executed_at: date.toISOString(),
      status: "completed",
      fee_usd: parseFloat((qty * price * 0.001).toFixed(4)),
    };
  }).sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());
}

export default function TradesPage() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await tradesApi.list({ page, limit: 20 });
        const raw = Array.isArray(data) ? data : data?.data ?? data?.trades ?? [];
        setTrades(raw);
        setTotalPages(data?.pagination?.totalPages ?? data?.total_pages ?? 1);
        setIsLive(true);
      } catch {
        setTrades(generateMockTrades());
        setTotalPages(1);
        setIsLive(false);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, page]);

  // Stats
  const totalVolume = trades.reduce((s, t) => s + (t.quantity * t.price), 0);
  const totalPnL = trades.reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
  const buys = trades.filter(t => t.side?.toUpperCase() === "BUY").length;
  const sells = trades.filter(t => t.side?.toUpperCase() === "SELL").length;

  const filtered = trades.filter(t => {
    const matchSide = sideFilter === "ALL" || t.side?.toUpperCase() === sideFilter;
    const matchSearch = !search || t.symbol?.toLowerCase().includes(search.toLowerCase())
      || t.base_asset?.toLowerCase().includes(search.toLowerCase());
    return matchSide && matchSearch;
  });

  const fmt = (n: number, dec = 2) =>
    n >= 1000 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: dec })}` : `$${n.toFixed(dec)}`;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Trade History</h1>
              <p className="text-gray-400 mt-1">
                Complete history of your trading activity
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isLive
                ? "bg-green-900/20 border-green-700/30 text-green-400"
                : "bg-yellow-900/20 border-yellow-700/30 text-yellow-400"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-yellow-500"}`} />
              {isLive ? "Live Data" : "Demo Data"}
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Trades", value: trades.length, icon: Activity, color: "text-cyan-400" },
              { label: "Total Volume", value: fmt(totalVolume, 0), icon: ArrowUpDown, color: "text-purple-400" },
              { label: "Realized P&L", value: (totalPnL >= 0 ? "+" : "") + fmt(totalPnL), icon: totalPnL >= 0 ? TrendingUp : TrendingDown, color: totalPnL >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "Buy / Sell", value: `${buys} / ${sells}`, icon: Activity, color: "text-blue-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-gray-500 font-medium">{label}</span>
                </div>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Side tabs */}
            <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
              {SIDE_FILTER.map(f => (
                <button
                  key={f}
                  onClick={() => setSideFilter(f)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    sideFilter === f
                      ? f === "BUY" ? "bg-emerald-600 text-white"
                        : f === "SELL" ? "bg-red-600 text-white"
                        : "bg-gray-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700/50 bg-gray-900/40">
                      {["Date", "Pair", "Side", "Qty", "Price", "Total", "P&L", "Fee"].map(h => (
                        <th key={h} className={`px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider ${h === "Date" || h === "Pair" || h === "Side" ? "text-left" : "text-right"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/30">
                    {filtered.map(trade => {
                      const isBuy = trade.side?.toUpperCase() === "BUY";
                      const pnl = trade.realized_pnl_usd;
                      const pair = trade.base_asset && trade.quote_asset
                        ? `${trade.base_asset}/${trade.quote_asset}`
                        : trade.symbol;
                      return (
                        <tr key={trade.id} className="hover:bg-gray-700/20 transition-colors">
                          <td className="px-5 py-4 text-gray-400 text-sm whitespace-nowrap">
                            {new Date(trade.executed_at).toLocaleDateString()}{" "}
                            <span className="text-gray-600 text-xs">
                              {new Date(trade.executed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-white font-semibold">{pair}</td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isBuy ? "bg-emerald-900/40 text-emerald-400" : "bg-red-900/40 text-red-400"
                            }`}>
                              {trade.side?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-white font-mono text-sm">{trade.quantity}</td>
                          <td className="px-5 py-4 text-right text-white font-mono text-sm">
                            {fmt(trade.price)}
                          </td>
                          <td className="px-5 py-4 text-right text-gray-300 font-mono text-sm">
                            {fmt(trade.quantity * trade.price)}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-semibold">
                            {pnl !== undefined ? (
                              <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                                {pnl >= 0 ? "+" : ""}{fmt(pnl)}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right text-gray-500 text-xs">
                            {trade.fee_usd !== undefined ? `$${trade.fee_usd}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-16 text-center text-gray-500">
                          No trades found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-700/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-40 hover:bg-gray-600 transition-colors text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-gray-400 text-sm">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-40 hover:bg-gray-600 transition-colors text-sm"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}