"use client";

import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import HoldingsTable from "@/components/dashboard/HoldingsTable";
import PortfolioOverview from "@/components/dashboard/PortfolioOverview";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import Skeleton from "@/components/ui/Skeleton";
import { usePortfolio, usePnlPerformance } from "@/hooks/queries";
import { buildRealizedPnlSeries } from "@/lib/performance";
import { assetColor } from "@/types/portfolio";
import { usd, signedUsd, signedPct } from "@/lib/format";
import { AlertCircle, Wallet } from "lucide-react";

export default function PortfolioPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("30D");

  const portfolio = usePortfolio();
  const performance = usePnlPerformance();

  const totals = portfolio.data?.totals;
  const holdings = portfolio.data?.holdings ?? [];

  const allocationData = holdings.map(holding => ({
    asset: holding.symbol,
    value: holding.marketValue,
    percentage: holding.allocation,
    color: assetColor(holding.symbol),
  }));

  const performanceData = buildRealizedPnlSeries(performance.data, selectedTimeframe);

  if (portfolio.isLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="mx-auto max-w-7xl space-y-6 p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
              <Skeleton className="h-[400px] rounded-xl xl:col-span-3" />
              <Skeleton className="h-[400px] rounded-xl xl:col-span-2" />
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (portfolio.isError) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="mx-auto max-w-md py-20 text-center">
            <AlertCircle className="text-vaultx-danger mx-auto mb-4 h-10 w-10" />
            <h2 className="text-foreground mb-2 text-xl font-semibold">
              Couldn&apos;t load your portfolio
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              {portfolio.error?.message || "The portfolio service didn't respond."}
            </p>
            <button
              onClick={() => portfolio.refetch()}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (holdings.length === 0) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="mx-auto max-w-md py-20 text-center">
            <Wallet className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
            <h2 className="text-foreground mb-2 text-xl font-semibold">Nothing to show yet</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Once you hold an asset, your allocation, cost basis and unrealized P&amp;L will
              appear here.
            </p>
            <a
              href="/settings"
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            >
              Connect an exchange
            </a>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const gainIsPositive = (totals?.unrealizedPnL ?? 0) >= 0;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div>
            <h1 className="text-foreground mb-2 text-3xl font-bold">Portfolio</h1>
            <p className="text-muted-foreground">
              Complete overview of your holdings and performance
            </p>
          </div>

          {/* Summary cards -- all three were previously hardcoded strings. */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="text-muted-foreground mb-2 text-sm font-medium">Total Value</h3>
              <p className="text-foreground font-mono text-2xl font-bold tabular-nums">
                {usd(totals?.totalValue)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {usd(totals?.totalCost)} invested
              </p>
            </div>
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="text-muted-foreground mb-2 text-sm font-medium">Unrealized P&amp;L</h3>
              <p
                className={`font-mono text-2xl font-bold tabular-nums ${
                  gainIsPositive ? "text-vaultx-success" : "text-vaultx-danger"
                }`}
              >
                {signedUsd(totals?.unrealizedPnL)}
              </p>
              <p
                className={`mt-1 font-mono text-xs tabular-nums ${
                  gainIsPositive ? "text-vaultx-success" : "text-vaultx-danger"
                }`}
              >
                {signedPct(totals?.unrealizedPnLPercent)}
              </p>
            </div>
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="text-muted-foreground mb-2 text-sm font-medium">Assets Held</h3>
              <p className="text-foreground font-mono text-2xl font-bold tabular-nums">
                {totals?.assetCount ?? holdings.length}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="xl:col-span-3">
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
            </div>

            <div className="xl:col-span-2">
              <PortfolioOverview
                totalBalance={usd(totals?.totalValue)}
                allocationData={allocationData}
                dayChangeLabel="Unrealized"
                weekChangeLabel="Cost Basis"
                dayChange={{
                  value: signedUsd(totals?.unrealizedPnL),
                  percentage: signedPct(totals?.unrealizedPnLPercent),
                  isPositive: gainIsPositive,
                }}
                weekChange={{
                  value: usd(totals?.totalCost),
                  percentage: `${totals?.assetCount ?? 0} assets`,
                  isPositive: true,
                }}
              />
            </div>
          </div>

          <HoldingsTable holdings={holdings} totalValue={totals?.totalValue ?? 0} />
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
