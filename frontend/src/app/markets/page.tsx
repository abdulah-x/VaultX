"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { pricesApi } from "@/lib/api";
import { TrendingUp, TrendingDown, RefreshCw, Search } from "lucide-react";

interface MarketAsset {
 symbol: string;
 name: string;
 price: number;
 change24h: number;
 volume24h?: number;
 isLive: boolean;
}

const CRYPTO_META: Record<string, { name: string; color: string }> = {
 BTC: { name: "Bitcoin", color: "#f7931a" },
 ETH: { name: "Ethereum", color: "#627eea" },
 BNB: { name: "BNB", color: "#f3ba2f" },
 SOL: { name: "Solana", color: "#00d4aa" },
 ADA: { name: "Cardano", color: "#0033ad" },
 DOT: { name: "Polkadot", color: "#e6007a" },
 AVAX: { name: "Avalanche", color: "#e84142" },
 MATIC:{ name: "Polygon", color: "#8247e5" },
 LINK: { name: "Chainlink", color: "#2a5ada" },
 UNI: { name: "Uniswap", color: "#ff007a" },
 XRP: { name: "Ripple", color: "#00aae4" },
 LTC: { name: "Litecoin", color: "#bfbbbb" },
};

const FALLBACK_MARKETS: MarketAsset[] = [
 { symbol: "BTC", name: "Bitcoin", price: 67500, change24h: 2.1, volume24h: 28_500_000_000, isLive: false },
 { symbol: "ETH", name: "Ethereum", price: 3420, change24h: -0.8, volume24h: 14_200_000_000, isLive: false },
 { symbol: "BNB", name: "BNB", price: 580, change24h: 1.4, volume24h: 2_100_000_000, isLive: false },
 { symbol: "SOL", name: "Solana", price: 148, change24h: 5.3, volume24h: 3_800_000_000, isLive: false },
 { symbol: "ADA", name: "Cardano", price: 0.61, change24h: -1.2, volume24h: 540_000_000, isLive: false },
 { symbol: "DOT", name: "Polkadot", price: 8.5, change24h: -2.1, volume24h: 320_000_000, isLive: false },
 { symbol: "AVAX", name: "Avalanche", price: 42.3, change24h: 3.8, volume24h: 860_000_000, isLive: false },
 { symbol: "MATIC", name: "Polygon", price: 1.2, change24h: -0.9, volume24h: 420_000_000, isLive: false },
 { symbol: "LINK", name: "Chainlink", price: 18.5, change24h: 5.2, volume24h: 780_000_000, isLive: false },
 { symbol: "XRP", name: "Ripple", price: 0.58, change24h: 2.4, volume24h: 1_450_000_000, isLive: false },
];

const SYMBOLS = FALLBACK_MARKETS.map((m) => m.symbol);

export default function MarketsPage() {
 const [markets, setMarkets] = useState<MarketAsset[]>(FALLBACK_MARKETS);
 const [isLive, setIsLive] = useState(false);
 const [loading, setLoading] = useState(true);
 const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
 const [search, setSearch] = useState("");
 const [sortBy, setSortBy] = useState<"symbol" | "price" | "change24h">("change24h");
 const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

 const fetchPrices = useCallback(async () => {
 try {
 const data = await pricesApi.getRealtime(SYMBOLS);
 // Adapt to whatever shape the backend returns
 const updated: MarketAsset[] = FALLBACK_MARKETS.map((base) => {
 const item =
 data?.[base.symbol] ||
 (Array.isArray(data) ? data.find((d: any) => d.symbol === base.symbol || d.asset_symbol === base.symbol) : null);
 return {
 ...base,
 price: parseFloat(item?.price || item?.current_price_usd || 0) || base.price,
 change24h: parseFloat(item?.change_24h || item?.price_change_percentage_24h || 0) || base.change24h,
 volume24h: parseFloat(item?.volume_24h || 0) || base.volume24h,
 isLive: true,
 };
 });
 setMarkets(updated);
 setIsLive(true);
 setLastUpdated(new Date());
 } catch {
 setIsLive(false);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchPrices();
 const interval = setInterval(fetchPrices, 30_000);
 return () => clearInterval(interval);
 }, [fetchPrices]);

 const formatPrice = (p: number) =>
 p >= 1000 ? `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}` :
 p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(4)}`;

 const formatVolume = (v?: number) => {
 if (!v) return "—";
 if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
 if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
 return `$${v.toLocaleString()}`;
 };

 const handleSort = (col: typeof sortBy) => {
 if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
 else { setSortBy(col); setSortDir("desc"); }
 };

 const filtered = markets
 .filter(m =>
 m.symbol.toLowerCase().includes(search.toLowerCase()) ||
 m.name.toLowerCase().includes(search.toLowerCase())
 )
 .sort((a, b) => {
 const mul = sortDir === "asc" ? 1 : -1;
 if (sortBy === "symbol") return mul * a.symbol.localeCompare(b.symbol);
 if (sortBy === "price") return mul * (a.price - b.price);
 return mul * (a.change24h - b.change24h);
 });

 const SortIcon = ({ col }: { col: typeof sortBy }) => (
 <span className={`ml-1 text-xs ${sortBy === col ? "text-primary" : "text-muted-foreground"}`}>
 {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "▸"}
 </span>
 );

 return (
 <ProtectedRoute>
 <AppLayout>
 <div className="p-6 space-y-6 max-w-7xl mx-auto">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-3xl font-bold text-foreground">Markets Overview</h1>
 <p className="text-muted-foreground mt-1">
 {isLive ? "Live cryptocurrency prices" : "Demonstration market data"}
 </p>
 </div>
 <div className="flex items-center gap-3">
 <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
 isLive
 ? "bg-vaultx-success/10 border-vaultx-success/40 text-vaultx-success"
 : "bg-vaultx-warning/10 border-vaultx-warning/40 text-vaultx-warning"
 }`}>
 <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-vaultx-success animate-pulse" : "bg-vaultx-warning"}`} />
 {isLive ? "Live" : "Demo"}
 </div>
 <button
 onClick={fetchPrices}
 className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
 title="Refresh"
 >
 <RefreshCw className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Search */}
 <div className="relative max-w-sm">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="text"
 placeholder="Search assets..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
 />
 </div>

 {/* Table */}
 <div className="bg-secondary backdrop-blur-sm border border-border rounded-2xl overflow-hidden">
 {loading ? (
 <div className="flex items-center justify-center py-20">
 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-border bg-card">
 <th className="px-6 py-4 text-left">
 <button
 onClick={() => handleSort("symbol")}
 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
 >
 Asset <SortIcon col="symbol" />
 </button>
 </th>
 <th className="px-6 py-4 text-right">
 <button
 onClick={() => handleSort("price")}
 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
 >
 Price <SortIcon col="price" />
 </button>
 </th>
 <th className="px-6 py-4 text-right">
 <button
 onClick={() => handleSort("change24h")}
 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
 >
 24h Change <SortIcon col="change24h" />
 </button>
 </th>
 <th className="px-6 py-4 text-right hidden md:table-cell">
 <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">24h Volume</span>
 </th>
 <th className="px-6 py-4 text-center hidden lg:table-cell">
 <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trend</span>
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-700/30">
 {filtered.map((asset, idx) => {
 const isPos = asset.change24h >= 0;
 const meta = CRYPTO_META[asset.symbol] || { name: asset.name, color: "#8b5cf6" };
 return (
 <tr key={asset.symbol} className="hover:bg-secondary transition-colors group">
 {/* Asset */}
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 <span className="text-sm text-muted-foreground w-5 text-right">{idx + 1}</span>
 <div
 className="w-9 h-9 rounded-full flex items-center justify-center text-foreground text-xs font-bold shadow-lg"
 style={{ backgroundColor: meta.color + "33", border: `1px solid ${meta.color}55` }}
 >
 <span style={{ color: meta.color }}>{asset.symbol.slice(0, 3)}</span>
 </div>
 <div>
 <div className="font-semibold text-foreground text-sm">{asset.symbol}</div>
 <div className="text-xs text-muted-foreground">{meta.name}</div>
 </div>
 </div>
 </td>

 {/* Price */}
 <td className="px-6 py-4 text-right font-mono text-foreground font-semibold">
 {formatPrice(asset.price)}
 </td>

 {/* 24h Change */}
 <td className="px-6 py-4 text-right">
 <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
 isPos ? "bg-vaultx-success/30 text-vaultx-success" : "bg-vaultx-danger/30 text-vaultx-danger"
 }`}>
 {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
 {isPos ? "+" : ""}{asset.change24h.toFixed(2)}%
 </span>
 </td>

 {/* Volume */}
 <td className="px-6 py-4 text-right text-muted-foreground text-sm hidden md:table-cell">
 {formatVolume(asset.volume24h)}
 </td>

 {/* Trend bar */}
 <td className="px-6 py-4 hidden lg:table-cell">
 <div className="flex justify-center">
 <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all ${isPos ? "bg-vaultx-success" : "bg-vaultx-danger"}`}
 style={{ width: `${Math.min(Math.abs(asset.change24h) * 10, 100)}%` }}
 />
 </div>
 </div>
 </td>
 </tr>
 );
 })}
 {filtered.length === 0 && (
 <tr>
 <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
 No assets matching "{search}"
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 )}
 {lastUpdated && (
 <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground text-right">
 Last updated: {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 30s
 </div>
 )}
 </div>
 </div>
 </AppLayout>
 </ProtectedRoute>
 );
}