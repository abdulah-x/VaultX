"use client";

import { Rocket } from "lucide-react";
import { assetColor } from "@/types/portfolio";
import { DEMO_HOLDINGS, DEMO_TOTALS, DEMO_OPTIMIZER, DEMO_SERIES, DEMO_RISK } from "./demoData";

/**
 * Browser-chrome framed view of the product surface.
 *
 * All figures are the demo account's real ones (see demoData) and the frame
 * says so in its own address bar.
 *
 * The left column shows **risk**, not holdings. Holdings and allocation are
 * already covered by the hero card and the donut it carries; repeating them
 * here made this the third identical view of the same four assets. Volatility
 * is the slice of the account that appears nowhere else, and it is the
 * clearest thing this product has that a balance aggregator does not.
 */

/** Per-asset annualized volatility, worst last. The bar is scaled against the
 *  highest value in the set rather than 100%, so the spread between assets is
 *  legible instead of every bar sitting in the lower third. */
function RiskRow({ symbol, vol, max }: { symbol: string; vol: number; max: number }) {
  const color = assetColor(symbol);
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 text-[11.5px] font-semibold" style={{ color: "#E2E8F0" }}>
        {symbol}
      </span>
      <div
        className="h-[7px] flex-1 overflow-hidden rounded-full"
        style={{ background: "rgba(148,163,184,0.12)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${(vol / max) * 100}%`, background: color }}
        />
      </div>
      <span
        className="w-12 text-right font-mono text-[11px] tabular-nums"
        style={{ color: "#94A3B8" }}
      >
        {vol.toFixed(1)}%
      </span>
    </div>
  );
}

function MiniBars({
  values,
  colors,
  height = 70,
}: {
  values: number[];
  colors: string | string[];
  height?: number;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="vx-bar-track" style={{ height }}>
      {values.map((v, i) => (
        <span
          key={i}
          className="vx-bar"
          style={{
            flex: 1,
            height: `${Math.max(6, (v / max) * 100)}%`,
            background: typeof colors === "string" ? colors : colors[i],
          }}
        />
      ))}
    </div>
  );
}

/** Scrolling strip of the demo account's actual positions -- not invented
 *  trade activity, which would be fabricated data dressed as a live feed. */
function TickerStrip() {
  const items = DEMO_HOLDINGS.map(
    h => `${h.symbol} · ${h.value} · ${h.alloc.toFixed(1)}% · ${h.pnl}`,
  );
  const loop = [...items, ...items];
  return (
    <div
      className="vx-ticker-wrap py-3.5"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="vx-ticker-track">
        {loop.map((t, i) => (
          <span key={i} className="vx-ticker-item">
            <span className="vx-pulse-dot" style={{ transform: "scale(0.7)" }}>
              <span className="vx-pulse-dot-core" />
            </span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProductWindow({
  onLaunchDemo,
  loading,
}: {
  onLaunchDemo: () => void;
  loading?: boolean;
}) {
  const maxVol = Math.max(...DEMO_RISK.assets.map(a => a.vol));

  return (
    <div
      className="relative mx-auto max-w-[1040px] overflow-hidden rounded-2xl"
      style={{
        background: "rgba(2,6,23,0.6)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        boxShadow: "0 25px 60px -15px rgba(0,0,0,0.7)",
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="h-3 w-3 rounded-full" style={{ background: "#F87171" }} />
        <span className="h-3 w-3 rounded-full" style={{ background: "#FBBF24" }} />
        <span className="h-3 w-3 rounded-full" style={{ background: "#34D399" }} />
        <span
          className="mx-auto rounded-lg px-4 py-1 font-mono text-xs"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
            color: "#94A3B8",
          }}
        >
          demo account · read-only
        </span>
      </div>

      <div className="vx-window-grid grid gap-5 p-7" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {/* Risk */}
        <div className="flex flex-col gap-4">
          <div
            className="text-[11px] font-semibold tracking-[0.08em] uppercase"
            style={{ color: "#94A3B8" }}
          >
            Annualized volatility
          </div>
          <div className="flex flex-col gap-3">
            {DEMO_RISK.assets.map(a => (
              <RiskRow key={a.symbol} symbol={a.symbol} vol={a.vol} max={maxVol} />
            ))}
          </div>
          <div
            className="mt-auto flex items-baseline justify-between pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-[11px]" style={{ color: "#64748B" }}>
              Portfolio · {DEMO_RISK.window}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums" style={{ color: "#F8FAFC" }}>
              {DEMO_RISK.portfolio.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Capital */}
        <div
          className="vx-window-col-mid flex flex-col gap-4 px-5"
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="text-[11px] font-semibold tracking-[0.08em] uppercase"
            style={{ color: "#94A3B8" }}
          >
            Total capital
          </div>
          <div>
            <div
              className="font-mono text-[26px] font-bold tabular-nums tracking-[-0.02em]"
              style={{ color: "#fff" }}
            >
              {DEMO_TOTALS.capital}
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: "#F87171" }}>
              ▼ {DEMO_TOTALS.capitalChange} today
            </span>
          </div>
          <MiniBars values={DEMO_SERIES} colors="#8B5CF6" />
          <div className="mt-1 flex flex-col gap-2.5">
            <button
              type="button"
              className="vx-launch-btn"
              onClick={onLaunchDemo}
              disabled={loading}
            >
              <Rocket className="h-4 w-4" />
              {loading ? "Opening demo…" : "Open the live demo"}
            </button>
            <button
              type="button"
              className="vx-view-demo"
              onClick={onLaunchDemo}
              disabled={loading}
            >
              No signup, no card, no keys →
            </button>
          </div>
        </div>

        {/* P&L */}
        <div className="flex flex-col gap-4">
          <div
            className="text-[11px] font-semibold tracking-[0.08em] uppercase"
            style={{ color: "#94A3B8" }}
          >
            Unrealized P&amp;L
          </div>
          <div>
            <div
              className="font-mono text-[26px] font-bold tabular-nums tracking-[-0.02em] tabular-nums"
              style={{ color: "#F87171" }}
            >
              {DEMO_TOTALS.unrealized}
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: "#F87171" }}>
              ▼ {DEMO_TOTALS.unrealizedPct}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[10.5px] tracking-[0.04em] uppercase" style={{ color: "#64748B" }}>
              Optimizer · {DEMO_OPTIMIZER.window}
            </div>
            <div className="flex items-baseline gap-2 font-mono text-sm tabular-nums">
              <span style={{ color: "#94A3B8" }}>{DEMO_OPTIMIZER.currentSharpe}</span>
              <span style={{ color: "#64748B" }}>→</span>
              <span style={{ color: "#6EE7B7" }}>{DEMO_OPTIMIZER.optimalSharpe}</span>
              <span className="font-sans text-[10.5px]" style={{ color: "#64748B" }}>
                Sharpe
              </span>
            </div>
          </div>
          <MiniBars
            values={DEMO_HOLDINGS.map(h => h.alloc)}
            colors={DEMO_HOLDINGS.map(h => assetColor(h.symbol))}
            height={56}
          />
        </div>
      </div>

      <TickerStrip />
    </div>
  );
}
