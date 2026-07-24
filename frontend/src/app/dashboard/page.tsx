"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import MetricCard from "@/components/ui/MetricCard";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import HoldingsTable from "@/components/dashboard/HoldingsTable";
import PortfolioOverview from "@/components/dashboard/PortfolioOverview";
import PortfolioHeatmap from "@/components/dashboard/PortfolioHeatmap";
import LivePriceTicker from "@/components/dashboard/LivePriceTicker";
import Skeleton from "@/components/ui/Skeleton";
import { usePortfolio, usePortfolioKpis, usePnlPerformance } from "@/hooks/queries";
import { buildRealizedPnlSeries } from "@/lib/performance";
import { assetColor } from "@/types/portfolio";
import { usd, signedUsd, signedPct, toNum } from "@/lib/format";
import {
  DollarSign,
  TrendingUp,
  PieChart as PieChartIcon,
  Target,
  AlertCircle,
  Wallet,
} from "lucide-react";

export default function DashboardPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("30D");

  const portfolio = usePortfolio();
  const kpis = usePortfolioKpis();
  const performance = usePnlPerformance();

  const totals = portfolio.data?.totals;
  const holdings = portfolio.data?.holdings ?? [];

  // /portfolio/kpis splits the capital gain into realized, unrealized and
  // today's move -- none of which /portfolio/summary carries, which is why the
  // Realized P&L card used to be hardcoded to $0.
  const capitalGain = kpis.data?.kpis?.capital_gain;
  const irr = kpis.data?.kpis?.growth_rate?.irr_percent;

  const performanceData = buildRealizedPnlSeries(performance.data, selectedTimeframe);

  const allocationData = holdings.map(holding => ({
    asset: holding.symbol,
    value: holding.marketValue,
    percentage: holding.allocation,
    color: assetColor(holding.symbol),
  }));

  const isLoading = portfolio.isLoading;
  const hasHoldings = holdings.length > 0;

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <LivePriceTicker />
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <Skeleton className="xl:col-span-3 h-[400px] rounded-lg" />
              <Skeleton className="xl:col-span-2 h-[400px] rounded-lg" />
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (portfolio.isError) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="p-6">
            <div className="max-w-md mx-auto text-center py-16">
              <AlertCircle className="w-10 h-10 text-vaultx-danger mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Couldn&apos;t load your portfolio
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                {portfolio.error?.message || "The portfolio service didn't respond."}
              </p>
              <button
                onClick={() => portfolio.refetch()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Try again
              </button>
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // A funded account and an empty one are different states, and showing zeroed
  // metric cards for the latter reads as a bug rather than as "nothing here yet".
  if (!hasHoldings) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <LivePriceTicker />
          <div className="p-6">
            <div className="max-w-md mx-auto text-center py-16">
              <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No holdings yet</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Connect an exchange or import your trade history, and your portfolio,
                P&amp;L and analytics will populate from it.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="/settings"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Connect an exchange
                </a>
                <a
                  href="/trades"
                  className="px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-accent transition-colors"
                >
                  Import trades
                </a>
              </div>
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <LivePriceTicker />

        <div className="p-6 space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Capital"
              value={usd(totals?.totalValue)}
              change={{
                value: signedUsd(capitalGain?.today_usd ?? 0),
                percentage: signedPct(capitalGain?.today_percent ?? 0),
                isPositive: toNum(capitalGain?.today_usd) >= 0,
              }}
              icon={<DollarSign className="w-5 h-5 text-primary" />}
            />
            <MetricCard
              title="Unrealized P&L"
              value={signedUsd(totals?.unrealizedPnL)}
              change={{
                value: `on ${usd(totals?.totalCost)} invested`,
                percentage: signedPct(totals?.unrealizedPnLPercent),
                isPositive: (totals?.unrealizedPnL ?? 0) >= 0,
              }}
              icon={<TrendingUp className="w-5 h-5 text-vaultx-warning" />}
            />
            <MetricCard
              title="Realized P&L"
              value={signedUsd(capitalGain?.realized_usd ?? 0)}
              change={{
                value: "closed positions",
                isPositive: toNum(capitalGain?.realized_usd) >= 0,
              }}
              icon={<Target className="w-5 h-5 text-vaultx-success" />}
            />
            <MetricCard
              title="Growth Rate (IRR)"
              value={irr !== undefined && irr !== null ? signedPct(irr) : "—"}
              change={{
                value: `${totals?.assetCount ?? 0} assets held`,
                isPositive: toNum(irr) >= 0,
              }}
              icon={<PieChartIcon className="w-5 h-5 text-primary" />}
            />
          </div>

          {/* Performance + allocation */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3" style={{ minHeight: "400px" }}>
              {/*
                Only the realized-P&L series is drawn. The backend records no
                daily portfolio balance, so a "total value over time" line would
                have to be invented -- which is exactly what this page used to do.
              */}
              <PerformanceChart
                data={performanceData}
                timeframe={selectedTimeframe}
                onTimeframeChange={setSelectedTimeframe}
                series={["realizedPnL"]}
                title="Realized P&L Over Time"
                emptyMessage={
                  performance.isLoading
                    ? "Loading performance history…"
                    : "No closed trades in this period yet. Realized P&L appears here once you sell a position."
                }
              />
            </div>

            <div className="xl:col-span-2" style={{ minHeight: "400px" }}>
              <PortfolioOverview
                totalBalance={usd(totals?.totalValue)}
                allocationData={allocationData}
                dayChangeLabel="Today"
                weekChangeLabel="Unrealized"
                dayChange={{
                  value: signedUsd(capitalGain?.today_usd ?? 0),
                  percentage: signedPct(capitalGain?.today_percent ?? 0),
                  isPositive: toNum(capitalGain?.today_usd) >= 0,
                }}
                weekChange={{
                  value: signedUsd(totals?.unrealizedPnL),
                  percentage: signedPct(totals?.unrealizedPnLPercent),
                  isPositive: (totals?.unrealizedPnL ?? 0) >= 0,
                }}
              />
            </div>
          </div>

          <HoldingsTable holdings={holdings} totalValue={totals?.totalValue ?? 0} />

          <PortfolioHeatmap holdings={holdings} totalValue={totals?.totalValue ?? 0} />
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
