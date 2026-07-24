"use client";

import { usePortfolioOptimize } from "@/hooks/queries";
import { assetColor } from "@/types/portfolio";
import { toNum } from "@/lib/format";
import { Scale, Info } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Surfaces GET /api/portfolio/optimize -- the Modern Portfolio Theory
 * optimizer built in Phase 7, which until now had no UI at all.
 *
 * It shows the user's *current* allocation beside the Sharpe-optimal one,
 * because the optimal weights alone aren't actionable: the gap between the two
 * is the finding.
 */

const pctOf = (weight: unknown) => toNum(weight) * 100;

function WeightBar({
  symbol,
  current,
  optimal,
}: {
  symbol: string;
  current: number;
  optimal: number;
}) {
  const delta = optimal - current;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground font-semibold">{symbol}</span>
        <span className="text-muted-foreground font-mono tabular-nums">
          {current.toFixed(1)}% → {optimal.toFixed(1)}%
          <span
            className={`ml-2 font-medium ${
              Math.abs(delta) < 0.05
                ? "text-muted-foreground"
                : delta > 0
                  ? "text-vaultx-success"
                  : "text-vaultx-danger"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}
          </span>
        </span>
      </div>
      <div className="space-y-1">
        <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full opacity-60"
            style={{ width: `${Math.min(current, 100)}%`, backgroundColor: assetColor(symbol) }}
          />
        </div>
        <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(optimal, 100)}%`, backgroundColor: assetColor(symbol) }}
          />
        </div>
      </div>
    </div>
  );
}

export default function OptimizerCard() {
  const { data, isLoading, isError } = usePortfolioOptimize();

  if (isLoading) {
    return <Skeleton className="h-80 rounded-2xl" />;
  }

  if (isError || !data?.success) {
    return (
      <div className="bg-card border-border rounded-2xl border p-6">
        <h3 className="text-foreground mb-2 flex items-center gap-2 font-semibold">
          <Scale className="text-primary h-4 w-4" />
          Allocation Optimizer
        </h3>
        <p className="text-muted-foreground text-sm">
          The optimizer is unavailable right now.
        </p>
      </div>
    );
  }

  const currentWeights: Record<string, number> = data.current_weights ?? {};
  const optimalWeights: Record<string, number> | null = data.optimal_weights ?? null;

  // The backend returns a `note` and null weights when there isn't enough
  // distinct-day price history to build a covariance matrix. Show that plainly
  // rather than rendering an empty chart.
  if (!optimalWeights) {
    return (
      <div className="bg-card border-border rounded-2xl border p-6">
        <h3 className="text-foreground mb-3 flex items-center gap-2 font-semibold">
          <Scale className="text-primary h-4 w-4" />
          Allocation Optimizer
        </h3>
        <div className="text-muted-foreground flex items-start gap-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{data.note || "Not enough price history yet to optimize."}</p>
        </div>
      </div>
    );
  }

  const symbols = Array.from(
    new Set([...Object.keys(currentWeights), ...Object.keys(optimalWeights)])
  ).sort((a, b) => pctOf(currentWeights[b]) - pctOf(currentWeights[a]));

  const currentSharpe = toNum(data.current_sharpe);
  const optimalSharpe = toNum(data.optimal_sharpe);

  return (
    <div className="bg-card border-border rounded-2xl border p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-foreground flex items-center gap-2 font-semibold">
            <Scale className="text-primary h-4 w-4" />
            Allocation Optimizer
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Sharpe-maximizing weights over {toNum(data.based_on_days)} days
          </p>
        </div>
      </div>

      {/* Sharpe comparison */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="border-border rounded-lg border p-3">
          <div className="text-muted-foreground mb-1 text-xs uppercase">Current Sharpe</div>
          <div className="text-foreground font-mono text-lg font-bold tabular-nums">
            {currentSharpe.toFixed(2)}
          </div>
        </div>
        <div className="border-primary/40 bg-primary/5 rounded-lg border p-3">
          <div className="text-muted-foreground mb-1 text-xs uppercase">Optimal Sharpe</div>
          <div className="text-primary font-mono text-lg font-bold tabular-nums">
            {optimalSharpe.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <span className="bg-muted-foreground/50 h-2 w-4 rounded-full" /> Current
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5">
          <span className="bg-muted-foreground h-2 w-4 rounded-full" /> Optimal
        </span>
      </div>

      <div className="space-y-4">
        {symbols.map(symbol => (
          <WeightBar
            key={symbol}
            symbol={symbol}
            current={pctOf(currentWeights[symbol])}
            optimal={pctOf(optimalWeights[symbol])}
          />
        ))}
      </div>

      <p className="text-muted-foreground border-border mt-5 border-t pt-4 text-xs">
        Derived from historical volatility and correlation. Past behaviour is not a prediction,
        and this is not financial advice.
      </p>
    </div>
  );
}
