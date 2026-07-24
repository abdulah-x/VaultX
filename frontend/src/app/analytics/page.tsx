"use client";

import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import OptimizerCard from "@/components/analytics/OptimizerCard";
import DcaPresetsCard from "@/components/analytics/DcaPresetsCard";
import Skeleton from "@/components/ui/Skeleton";
import { usePnlComprehensive, usePnlPerformance, useTrades } from "@/hooks/queries";
import { buildRealizedPnlSeries } from "@/lib/performance";
import { extractTrades, aggregateTrades, extractAssetPnl } from "@/lib/trades";
import { assetColor } from "@/types/portfolio";
import { compactUsd, signedUsd, toNum } from "@/lib/format";
import { TrendingUp, Target, BarChart3, Activity, Award } from "lucide-react";
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

export default function AnalyticsPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("30D");

  const comprehensive = usePnlComprehensive();
  const performance = usePnlPerformance();
  // A single wide page is enough to aggregate over: win rate and best/worst
  // trade are computed client-side from the real trade list, and paging
  // through it would give a rate for the visible page rather than the account.
  const trades = useTrades({ page: 1, page_size: 200 });

  const isLoading = comprehensive.isLoading || trades.isLoading;

  const pnlSummary = comprehensive.data?.pnl_summary ?? {};
  const assetPnl = extractAssetPnl(comprehensive.data);
  const aggregates = aggregateTrades(extractTrades(trades.data));
  const performanceData = buildRealizedPnlSeries(performance.data, selectedTimeframe);

  /*
   * Realized P&L is summed from the trade rows rather than read off
   * /api/pnl/comprehensive.
   *
   * That endpoint's `realized_pnl` is currently equal to its own
   * `total_volume` (11785 for the demo account) -- it reports gross traded
   * volume as profit. Summing `realized_pnl_usd` across trades gives 2552.50,
   * which /api/portfolio/kpis independently agrees with, so the trade rows are
   * the trustworthy source until the backend field is fixed.
   */
  const realized = aggregates.totalRealized;
  const unrealized = toNum(pnlSummary.unrealized_pnl);

  const winLossData = [
    { name: "Wins", value: aggregates.winningTrades, color: "#10b981" },
    { name: "Losses", value: aggregates.losingTrades, color: "#ef4444" },
  ];

  const metricCards = [
    {
      label: "Realized P&L",
      value: signedUsd(realized),
      icon: TrendingUp,
      color: realized >= 0 ? "text-vaultx-success" : "text-vaultx-danger",
      bg:
        realized >= 0
          ? "bg-vaultx-success/10 border-vaultx-success/30"
          : "bg-vaultx-danger/10 border-vaultx-danger/30",
    },
    {
      label: "Unrealized P&L",
      value: signedUsd(unrealized),
      icon: BarChart3,
      color: unrealized >= 0 ? "text-vaultx-success" : "text-vaultx-danger",
      bg: "bg-primary/10 border-primary/30",
    },
    {
      label: "Win Rate",
      // Null rather than 0 when nothing has been closed -- "0%" would read as
      // "every trade lost" instead of "no trades have closed".
      value: aggregates.winRate === null ? "—" : `${aggregates.winRate.toFixed(1)}%`,
      icon: Award,
      color: "text-vaultx-secondary",
      bg: "bg-vaultx-secondary/10 border-vaultx-secondary/30",
      hint:
        aggregates.winRate === null
          ? "No closed trades yet"
          : `${aggregates.winningTrades} of ${aggregates.closedTrades} closed`,
    },
    {
      label: "Total Trades",
      value: String(aggregates.totalTrades),
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/30",
      hint: `${toNum(pnlSummary.total_fees).toFixed(2)} paid in fees`,
    },
  ];

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="mx-auto max-w-7xl space-y-6 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-[420px] rounded-2xl" />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Skeleton className="h-80 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div>
            <h1 className="text-foreground text-3xl font-bold">Portfolio Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Performance, risk and strategy, computed from your own trade history
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map(({ label, value, icon: Icon, color, bg, hint }) => (
              <div key={label} className={`rounded-2xl border p-5 ${bg}`}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-muted-foreground text-sm font-medium">{label}</span>
                </div>
                <p className={`font-mono text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
              </div>
            ))}
          </div>

          {/* Realized P&L over time */}
          <PerformanceChart
            data={performanceData}
            timeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
            series={["realizedPnL"]}
            title="Realized P&L Over Time"
            emptyMessage={
              performance.isLoading
                ? "Loading performance history…"
                : "No closed trades in this period yet."
            }
          />

          {/* The two features competitors don't have. */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <OptimizerCard />
            <DcaPresetsCard />
          </div>

          {/* Asset performance + win/loss + stats */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="bg-card border-border rounded-2xl border p-6 xl:col-span-2">
              <h3 className="text-foreground mb-4 flex items-center gap-2 font-semibold">
                <BarChart3 className="text-primary h-4 w-4" />
                Asset Performance
              </h3>
              {assetPnl.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={assetPnl} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis
                      type="number"
                      tickFormatter={v => compactUsd(v)}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="symbol"
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip
                      formatter={(val: number | string | undefined) => [
                        val !== undefined ? signedUsd(val) : "—",
                        "P&L",
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="pnl_usd" radius={[0, 6, 6, 0]}>
                      {assetPnl.map(entry => (
                        <Cell
                          key={entry.symbol}
                          fill={entry.pnl_usd >= 0 ? assetColor(entry.symbol) : "#ef4444"}
                          opacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
                  No asset data available
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Win/Loss */}
              <div className="bg-card border-border rounded-2xl border p-6">
                <h3 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
                  <Target className="text-vaultx-secondary h-4 w-4" />
                  Win / Loss
                </h3>
                {aggregates.closedTrades === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No closed trades yet. Sell a position and its result appears here.
                  </p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={100} height={100}>
                      <PieChart>
                        <Pie
                          data={winLossData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={46}
                          dataKey="value"
                          strokeWidth={0}
                          isAnimationActive={false}
                        >
                          {winLossData.map(entry => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-vaultx-success h-2.5 w-2.5 rounded-full" />
                        <span className="text-foreground text-sm">
                          {aggregates.winningTrades} wins
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-vaultx-danger h-2.5 w-2.5 rounded-full" />
                        <span className="text-foreground text-sm">
                          {aggregates.losingTrades} losses
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Trading stats */}
              <div className="bg-card border-border rounded-2xl border p-6">
                <h3 className="text-foreground mb-4 font-semibold">Trading Stats</h3>
                <div className="space-y-3">
                  {[
                    {
                      label: "Avg Trade Size",
                      value: compactUsd(aggregates.averageTradeSize),
                      color: "text-foreground",
                    },
                    {
                      label: "Best Trade",
                      value:
                        aggregates.bestTrade === null ? "—" : signedUsd(aggregates.bestTrade),
                      color: "text-vaultx-success",
                    },
                    {
                      label: "Worst Trade",
                      value:
                        aggregates.worstTrade === null ? "—" : signedUsd(aggregates.worstTrade),
                      color: "text-vaultx-danger",
                    },
                    {
                      label: "Total Volume",
                      value: compactUsd(aggregates.totalVolume),
                      color: "text-primary",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="border-border flex items-center justify-between border-b py-1.5 last:border-0"
                    >
                      <span className="text-muted-foreground text-sm">{label}</span>
                      <span className={`font-mono text-sm font-semibold tabular-nums ${color}`}>
                        {value}
                      </span>
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
