"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { pnlApi } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import { mockPerformanceData } from "@/data/mockData";
import {
 TrendingUp,
 TrendingDown,
 Target,
 BarChart3,
 Activity,
 Award,
} from "lucide-react";
import {
 BarChart,
 Bar,
 XAxis,
 YAxis,
 Tooltip,
 ResponsiveContainer,
 PieChart,
 Pie,
 Cell,
} from "recharts";

interface PnLSummary {
 total_realized_pnl?: number;
 total_unrealized_pnl?: number;
 win_rate?: number;
 total_trades?: number;
 winning_trades?: number;
 losing_trades?: number;
 average_trade_size?: number;
 best_trade?: number;
 worst_trade?: number;
 profit_factor?: number;
 asset_performance?: Array<{ symbol: string; pnl_usd: number; pnl_percentage: number }>;
}

const MOCK_SUMMARY: PnLSummary = {
 total_realized_pnl: 324500,
 total_unrealized_pnl: 158200,
 win_rate: 78.5,
 total_trades: 247,
 winning_trades: 194,
 losing_trades: 53,
 average_trade_size: 8420,
 best_trade: 45200,
 worst_trade: -12800,
 profit_factor: 2.34,
 asset_performance: [
 { symbol: "BTC", pnl_usd: 185000, pnl_percentage: 34.2 },
 { symbol: "ETH", pnl_usd: 92000, pnl_percentage: 18.6 },
 { symbol: "SOL", pnl_usd: 31000, pnl_percentage: 24.1 },
 { symbol: "ADA", pnl_usd: 8000, pnl_percentage: 9.2 },
 { symbol: "BNB", pnl_usd: -2800, pnl_percentage: -3.8 },
 ],
};

const ASSET_COLORS: Record<string, string> = {
 BTC: "#f7931a", ETH: "#627eea", SOL: "#00d4aa",
 ADA: "#0033ad", BNB: "#f3ba2f", default: "#8b5cf6",
};

const fmt$ = (n: number) =>
 Math.abs(n) >= 1_000_000
 ? `$${(n / 1_000_000).toFixed(2)}M`
 : Math.abs(n) >= 1_000
 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
 : `$${n.toFixed(2)}`;

export default function AnalyticsPage() {
 const { user } = useAuth();
 const [data, setData] = useState<PnLSummary>(MOCK_SUMMARY);
 const [isLive, setIsLive] = useState(false);
 const [loading, setLoading] = useState(true);
 const [selectedTimeframe, setSelectedTimeframe] = useState("30D");

 useEffect(() => {
 if (!user) return;
 const fetch = async () => {
 try {
 const res = await pnlApi.summary();
 if (res) { setData(res); setIsLive(true); }
 } catch { setIsLive(false); }
 finally { setLoading(false); }
 };
 fetch();
 }, [user]);

 const winLossData = [
 { name: "Wins", value: data.winning_trades || 0, color: "#10b981" },
 { name: "Losses", value: data.losing_trades || 0, color: "#ef4444" },
 ];

 const metricCards = [
 {
 label: "Realized P&L",
 value: fmt$(data.total_realized_pnl || 0),
 icon: TrendingUp,
 positive: (data.total_realized_pnl || 0) >= 0,
 color: (data.total_realized_pnl || 0) >= 0 ? "text-vaultx-success" : "text-vaultx-danger",
 bg: (data.total_realized_pnl || 0) >= 0 ? "bg-vaultx-success/20 border-vaultx-success/30" : "bg-vaultx-danger/20 border-vaultx-danger/30",
 },
 {
 label: "Unrealized P&L",
 value: fmt$(data.total_unrealized_pnl || 0),
 icon: BarChart3,
 positive: (data.total_unrealized_pnl || 0) >= 0,
 color: (data.total_unrealized_pnl || 0) >= 0 ? "text-primary" : "text-vaultx-danger",
 bg: "bg-primary/20 border-primary/30",
 },
 {
 label: "Win Rate",
 value: `${(data.win_rate || 0).toFixed(1)}%`,
 icon: Award,
 color: "text-vaultx-secondary",
 bg: "bg-vaultx-secondary/20 border-vaultx-secondary/30",
 },
 {
 label: "Total Trades",
 value: data.total_trades?.toString() || "0",
 icon: Activity,
 color: "text-primary",
 bg: "bg-primary/10 border-primary/30",
 },
 ];

 return (
 <ProtectedRoute>
 <AppLayout>
 <div className="p-6 space-y-6 max-w-7xl mx-auto">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-3xl font-bold text-foreground">Portfolio Analytics</h1>
 <p className="text-muted-foreground mt-1">Deep dive into your trading performance</p>
 </div>
 <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
 isLive
 ? "bg-vaultx-success/10 border-vaultx-success/40 text-vaultx-success"
 : "bg-vaultx-warning/10 border-vaultx-warning/40 text-vaultx-warning"
 }`}>
 <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-vaultx-success animate-pulse" : "bg-vaultx-warning"}`} />
 {isLive ? "Live Data" : "Demo Data"}
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
 {metricCards.map(({ label, value, icon: Icon, color, bg }) => (
 <div key={label} className={`border rounded-2xl p-5 ${bg}`}>
 <div className="flex items-center gap-2 mb-3">
 <Icon className={`w-4 h-4 ${color}`} />
 <span className="text-sm text-muted-foreground font-medium">{label}</span>
 </div>
 <p className={`text-2xl font-bold ${color}`}>{value}</p>
 </div>
 ))}
 </div>

 {/* Performance Chart */}
 <div className="bg-secondary border border-border rounded-2xl p-6">
 <PerformanceChart
 data={mockPerformanceData[selectedTimeframe as keyof typeof mockPerformanceData] || mockPerformanceData["30D"]}
 timeframe={selectedTimeframe}
 onTimeframeChange={setSelectedTimeframe}
 />
 </div>

 {/* Bottom row: Asset performance + Win/Loss + Trading stats */}
 <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
 {/* Asset P&L bar chart */}
 <div className="xl:col-span-2 bg-secondary border border-border rounded-2xl p-6">
 <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
 <BarChart3 className="w-4 h-4 text-primary" />
 Asset Performance
 </h3>
 {data.asset_performance && data.asset_performance.length > 0 ? (
 <ResponsiveContainer width="100%" height={220}>
 <BarChart data={data.asset_performance} layout="vertical" margin={{ left: 10, right: 20 }}>
 <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}K`} tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
 <YAxis type="category" dataKey="symbol" tick={{ fill: "#d1d5db", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={40} />
 <Tooltip
 formatter={(val: number | string | undefined) => [val !== undefined ? fmt$(Number(val)) : "—", "P&L"]}
 contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", color: "#f9fafb" }}
 />
 <Bar dataKey="pnl_usd" radius={[0, 6, 6, 0]}>
 {data.asset_performance.map((entry) => (
 <Cell
 key={entry.symbol}
 fill={entry.pnl_usd >= 0 ? (ASSET_COLORS[entry.symbol] || "#8b5cf6") : "#ef4444"}
 opacity={0.85}
 />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <div className="flex items-center justify-center h-40 text-muted-foreground">No asset data available</div>
 )}
 </div>

 {/* Right column */}
 <div className="space-y-6">
 {/* Win/Loss donut */}
 <div className="bg-secondary border border-border rounded-2xl p-6">
 <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
 <Target className="w-4 h-4 text-vaultx-secondary" />
 Win / Loss
 </h3>
 <div className="flex items-center gap-4">
 <ResponsiveContainer width={100} height={100}>
 <PieChart>
 <Pie data={winLossData} cx="50%" cy="50%" innerRadius={30} outerRadius={46} dataKey="value" strokeWidth={0}>
 {winLossData.map((entry) => (
 <Cell key={entry.name} fill={entry.color} />
 ))}
 </Pie>
 </PieChart>
 </ResponsiveContainer>
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <div className="w-2.5 h-2.5 rounded-full bg-vaultx-success" />
 <span className="text-sm text-foreground">{data.winning_trades} wins</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2.5 h-2.5 rounded-full bg-vaultx-danger" />
 <span className="text-sm text-foreground">{data.losing_trades} losses</span>
 </div>
 </div>
 </div>
 </div>

 {/* Trading stats */}
 <div className="bg-secondary border border-border rounded-2xl p-6">
 <h3 className="text-foreground font-semibold mb-4">Trading Stats</h3>
 <div className="space-y-3">
 {[
 { label: "Avg Trade Size", value: fmt$(data.average_trade_size || 0), color: "text-foreground" },
 { label: "Best Trade", value: fmt$(data.best_trade || 0), color: "text-vaultx-success" },
 { label: "Worst Trade", value: fmt$(data.worst_trade || 0), color: "text-vaultx-danger" },
 { label: "Profit Factor", value: (data.profit_factor || 0).toFixed(2), color: "text-primary" },
 ].map(({ label, value, color }) => (
 <div key={label} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
 <span className="text-muted-foreground text-sm">{label}</span>
 <span className={`font-semibold text-sm ${color}`}>{value}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>
 </AppLayout>
 </ProtectedRoute>
 );
}