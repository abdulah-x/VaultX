/**
 * Builds the performance-chart series from real API data.
 *
 * What replaced what: the dashboard used to synthesize this chart with
 * Math.random(), inventing a growth curve, a volatility band and a plausible
 * "journey from underwater to profitable" out of nothing but the *current*
 * portfolio value. It redrew differently on every render.
 *
 * What is actually available: /api/pnl/performance returns
 * `time_series.daily_pnl` -- a real map of trade date to realized P&L for that
 * day. That is a genuine, verifiable series.
 *
 * What is NOT available: portfolio value history. The PortfolioSnapshot table
 * was dropped in Phase 5.5 and nothing records a daily balance, so there is no
 * honest `totalValue` series to draw. Callers therefore render this with
 * `series={["realizedPnL"]}` rather than plotting a fabricated value line.
 */

import { toNum } from "@/lib/format";

export interface PerformancePoint {
  date: string;
  totalValue: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const TIMEFRAME_DAYS: Record<string, number> = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
  "1Y": 365,
  ALL: Number.POSITIVE_INFINITY,
};

function formatLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Turns `{ "2026-07-02": 390, "2026-07-10": 1262.5 }` into a cumulative
 * realized-P&L series, filtered to the selected timeframe.
 */
export function buildRealizedPnlSeries(
  performanceResponse: unknown,
  timeframe = "30D"
): PerformancePoint[] {
  const dailyPnl = (performanceResponse as any)?.time_series?.daily_pnl;
  if (!dailyPnl || typeof dailyPnl !== "object") return [];

  const windowDays = TIMEFRAME_DAYS[timeframe] ?? 30;
  const cutoff = Number.isFinite(windowDays) ? Date.now() - windowDays * DAY_MS : -Infinity;

  const entries = Object.entries(dailyPnl as Record<string, unknown>)
    .map(([date, value]) => ({ date, time: new Date(date).getTime(), value: toNum(value) }))
    .filter(entry => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time);

  if (entries.length === 0) return [];

  // Accumulate over the *full* history first, then trim to the window. Summing
  // only the visible entries would restart the running total at the window
  // edge and understate every point in it.
  let running = 0;
  const cumulative = entries.map(entry => {
    running += entry.value;
    return { ...entry, cumulative: running };
  });

  return cumulative
    .filter(entry => entry.time >= cutoff)
    .map(entry => ({
      date: formatLabel(new Date(entry.time)),
      totalValue: 0,
      realizedPnL: entry.cumulative,
      unrealizedPnL: 0,
    }));
}

/** Trading-activity stats that accompany the series, all real. */
export function extractPerformanceMetrics(performanceResponse: unknown) {
  const metrics = (performanceResponse as any)?.performance_metrics ?? {};
  return {
    totalTrades: toNum(metrics.total_trades),
    buyTrades: toNum(metrics.buy_trades),
    sellTrades: toNum(metrics.sell_trades),
    totalVolume: toNum(metrics.total_volume),
    totalFees: toNum(metrics.total_fees),
    tradingPeriodDays: toNum(metrics.trading_period_days),
    avgTradesPerDay: toNum(metrics.avg_trades_per_day),
    currentPortfolioValue: toNum(metrics.current_portfolio_value),
  };
}
