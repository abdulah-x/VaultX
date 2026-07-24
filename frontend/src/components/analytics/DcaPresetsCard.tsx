"use client";

import { useState } from "react";
import { useDcaPresets } from "@/hooks/queries";
import { usd, signedPct, toNum } from "@/lib/format";
import { CalendarClock, Info } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Surfaces GET /api/strategy/dca-presets -- the DCA backtester from Phase 8,
 * which likewise had no UI.
 *
 * The backend ranks contribution cadences by ROI over real historical closes
 * for each asset the user actually holds.
 */

const CONTRIBUTIONS = [50, 100, 250, 500];

interface Preset {
  frequency: string;
  contributions_count: number;
  total_invested: string;
  units_accumulated: string;
  average_cost_basis: string;
  final_value: string;
  profit_usd: string;
  roi_percent: string;
  first_buy: string;
  last_buy: string;
}

interface AssetPresets {
  symbol: string;
  presets: Preset[];
}

export default function DcaPresetsCard() {
  const [contribution, setContribution] = useState(100);
  const { data, isLoading, isError } = useDcaPresets(contribution);

  if (isLoading) {
    return <Skeleton className="h-80 rounded-2xl" />;
  }

  if (isError || !data?.success) {
    return (
      <div className="bg-card border-border rounded-2xl border p-6">
        <h3 className="text-foreground mb-2 flex items-center gap-2 font-semibold">
          <CalendarClock className="text-primary h-4 w-4" />
          Auto-Invest Backtest
        </h3>
        <p className="text-muted-foreground text-sm">The backtester is unavailable right now.</p>
      </div>
    );
  }

  const assets: AssetPresets[] = Array.isArray(data.assets) ? data.assets : [];

  return (
    <div className="bg-card border-border rounded-2xl border p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-foreground flex items-center gap-2 font-semibold">
            <CalendarClock className="text-primary h-4 w-4" />
            Auto-Invest Backtest
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Best-performing cadence per asset over {toNum(data.based_on_days)} days
          </p>
        </div>

        <div className="bg-secondary border-border flex items-center gap-1 rounded-lg border p-1">
          {CONTRIBUTIONS.map(amount => (
            <button
              key={amount}
              onClick={() => setContribution(amount)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                contribution === amount
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="text-muted-foreground flex items-start gap-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{data.note || "No holdings with enough price history to backtest yet."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assets.map(asset => {
            // The API returns presets already ranked by ROI.
            const best = asset.presets?.[0];
            if (!best) return null;
            const roi = toNum(best.roi_percent);
            return (
              <div
                key={asset.symbol}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-[7rem]">
                  <div className="text-foreground text-sm font-semibold">{asset.symbol}</div>
                  <div className="text-muted-foreground text-xs capitalize">
                    {best.frequency} · {best.contributions_count} buys
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-muted-foreground text-xs">Invested</div>
                  <div className="text-foreground font-mono text-sm tabular-nums">
                    {usd(best.total_invested)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-muted-foreground text-xs">Value</div>
                  <div className="text-foreground font-mono text-sm tabular-nums">
                    {usd(best.final_value)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-muted-foreground text-xs">ROI</div>
                  <div
                    className={`font-mono text-sm font-bold tabular-nums ${
                      roi >= 0 ? "text-vaultx-success" : "text-vaultx-danger"
                    }`}
                  >
                    {signedPct(roi)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground border-border mt-5 border-t pt-4 text-xs">
        A backtest over historical prices, not a prediction or financial advice.
      </p>
    </div>
  );
}
