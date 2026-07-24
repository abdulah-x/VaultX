"use client";

import { TrendingUp, TrendingDown, Wallet, Scale } from "lucide-react";
import { assetColor } from "@/types/portfolio";

/**
 * A framed preview of the product surface, shown in the hero.
 *
 * This is the central device of the reference design: a card that frames the
 * actual interface rather than a decorative panel or an abstract illustration.
 *
 * The figures are the **public demo account's** -- the same seeded portfolio
 * anyone reaches through "Explore the live demo", captured from the live API.
 * It is labelled as such, because an unlabelled dashboard on a marketing page
 * reads as the visitor's own data, and inventing impressive numbers for a
 * finance product is precisely the thing this app exists not to do.
 */

const HOLDINGS = [
  { symbol: "BTC", name: "Bitcoin", value: "$19,248.22", alloc: 59.5, pnl: "+$2,635.72", up: true },
  { symbol: "ETH", name: "Ethereum", value: "$6,526.59", alloc: 20.2, pnl: "-$3,238.41", up: false },
  { symbol: "BNB", name: "BNB", value: "$4,497.92", alloc: 13.9, pnl: "+$457.92", up: true },
  { symbol: "SOL", name: "Solana", value: "$1,851.00", alloc: 5.7, pnl: "-$599.00", up: false },
];

function Stat({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="border-border/60 bg-background/40 rounded-xl border p-4">
      <div className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className="text-foreground font-mono text-xl font-bold tracking-tight tabular-nums">
        {value}
      </div>
      {sub && (
        <div
          className={`mt-1 font-mono text-xs tabular-nums ${
            positive === undefined
              ? "text-muted-foreground"
              : positive
                ? "text-vaultx-success"
                : "text-vaultx-danger"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export default function ProductPreview() {
  return (
    <div className="relative">
      {/* Ambient glow behind the frame */}
      <div
        aria-hidden
        className="bg-primary/20 absolute -inset-x-8 -top-8 bottom-0 -z-10 rounded-[2rem] blur-3xl"
      />

      <div className="border-border bg-card/80 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm">
        {/* Window chrome */}
        <div className="border-border/60 bg-background/60 flex items-center gap-2 border-b px-4 py-3">
          <div className="flex gap-1.5">
            <span className="bg-vaultx-danger/60 h-2.5 w-2.5 rounded-full" />
            <span className="bg-vaultx-warning/60 h-2.5 w-2.5 rounded-full" />
            <span className="bg-vaultx-success/60 h-2.5 w-2.5 rounded-full" />
          </div>
          <div className="text-muted-foreground mx-auto flex items-center gap-1.5 text-xs">
            <Wallet className="h-3 w-3" />
            Demo account · read-only
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total Capital" value="$32,369" sub="-1.40% today" positive={false} />
            <Stat label="Unrealized" value="-$1,428" sub="-4.23%" positive={false} />
            <Stat label="Realized" value="+$2,552" sub="4 closed" positive />
            <Stat label="IRR" value="+5.33%" sub="5 assets" positive />
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            {/* Holdings */}
            <div className="border-border/60 bg-background/40 rounded-xl border p-4 lg:col-span-3">
              <div className="text-muted-foreground mb-3 text-[11px] font-medium tracking-wider uppercase">
                Holdings
              </div>
              <div className="space-y-2.5">
                {HOLDINGS.map(holding => (
                  <div key={holding.symbol} className="flex items-center gap-3">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: `${assetColor(holding.symbol)}26`,
                        color: assetColor(holding.symbol),
                      }}
                    >
                      {holding.symbol.slice(0, 3)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground truncate text-xs font-semibold">
                        {holding.name}
                      </div>
                      <div className="bg-secondary mt-1 h-1 w-full overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${holding.alloc}%`,
                            backgroundColor: assetColor(holding.symbol),
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-foreground font-mono text-xs font-semibold tabular-nums">
                        {holding.value}
                      </div>
                      <div
                        className={`flex items-center justify-end gap-0.5 font-mono text-[10px] tabular-nums ${
                          holding.up ? "text-vaultx-success" : "text-vaultx-danger"
                        }`}
                      >
                        {holding.up ? (
                          <TrendingUp className="h-2.5 w-2.5" />
                        ) : (
                          <TrendingDown className="h-2.5 w-2.5" />
                        )}
                        {holding.pnl}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimizer */}
            <div className="border-border/60 bg-background/40 rounded-xl border p-4 lg:col-span-2">
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase">
                <Scale className="h-3 w-3" />
                Optimizer
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Current</div>
                  <div className="text-foreground font-mono text-base font-bold tabular-nums">
                    -1.45
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Optimal</div>
                  <div className="text-primary font-mono text-base font-bold tabular-nums">
                    -0.64
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {HOLDINGS.slice(0, 3).map(holding => (
                  <div key={holding.symbol}>
                    <div className="mb-1 flex justify-between text-[10px]">
                      <span className="text-foreground font-semibold">{holding.symbol}</span>
                      <span className="text-muted-foreground font-mono tabular-nums">
                        {holding.alloc.toFixed(0)}%
                      </span>
                    </div>
                    <div className="bg-secondary h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full opacity-70"
                        style={{
                          width: `${holding.alloc}%`,
                          backgroundColor: assetColor(holding.symbol),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-muted-foreground mt-3 text-[10px] leading-relaxed">
                Sharpe-maximizing weights over 90 days
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
