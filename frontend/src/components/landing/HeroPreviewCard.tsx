"use client";

import { motion } from "framer-motion";
import { assetColor } from "@/types/portfolio";
import AssetMark from "./AssetMark";
import { DEMO_HOLDINGS, DEMO_TOTALS } from "./demoData";

/**
 * The tilted product card in the hero -- the centrepiece of the design.
 *
 * Figures are the demo account's real ones (see demoData). Note that ETH and
 * SOL are genuinely down: the P&L pills below resolve their own colour rather
 * than being hardcoded green, because a preview that shows every position
 * winning is a fabrication regardless of where the numbers came from.
 */

function MiniChart() {
  return (
    <svg
      width="100%"
      height="76"
      viewBox="0 0 280 76"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="vx-hero-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,58 C24,54 40,50 60,46 C84,40 96,44 116,36 C140,26 152,32 172,22 C196,10 208,18 232,8 C248,2 264,6 280,4 L280,76 L0,76 Z"
        fill="url(#vx-hero-chart-fill)"
      />
      <path
        d="M0,58 C24,54 40,50 60,46 C84,40 96,44 116,36 C140,26 152,32 172,22 C196,10 208,18 232,8 C248,2 264,6 280,4"
        fill="none"
        stroke="#10B981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="280" cy="4" r="4.5" fill="#10B981" />
      <circle
        cx="280"
        cy="4"
        r="4.5"
        fill="none"
        stroke="#10B981"
        strokeWidth="2"
        className="vx-chart-dot"
      />
    </svg>
  );
}

function AssetRow({ h }: { h: (typeof DEMO_HOLDINGS)[number] }) {
  const color = assetColor(h.symbol);
  const filled = Math.round(h.alloc / 10);
  const tone = h.up
    ? {
        fg: "#6EE7B7",
        bg: "rgba(16,185,129,0.14)",
        bd: "rgba(16,185,129,0.25)",
      }
    : {
        fg: "#FCA5A5",
        bg: "rgba(248,113,113,0.12)",
        bd: "rgba(248,113,113,0.25)",
      };

  return (
    <div className="flex items-center gap-3">
      <AssetMark symbol={h.symbol} size={30} />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold" style={{ color: "#E2E8F0" }}>
            {h.symbol}{" "}
            <span className="font-normal" style={{ color: "#64748B" }}>
              {h.name}
            </span>
          </span>
          <span
            className="rounded-full px-[7px] py-[2px] text-[11.5px] font-semibold"
            style={{
              color: tone.fg,
              background: tone.bg,
              border: `1px solid ${tone.bd}`,
            }}
          >
            {h.pnl}
          </span>
        </div>
        <div className="flex gap-[3px]">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 12,
                height: 5,
                borderRadius: 2,
                background: i < filled ? color : "rgba(148,163,184,0.14)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HeroPreviewCard() {
  const top3 = DEMO_HOLDINGS.slice(0, 3);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -top-[10%] -right-[10%] z-0 h-[400px] w-[400px] rounded-full"
        style={{ background: "rgba(79,70,229,0.25)", filter: "blur(120px)" }}
      />
      <div
        aria-hidden
        className="absolute bottom-[-8%] left-[2%] z-0 h-[350px] w-[350px] rounded-full"
        style={{ background: "rgba(147,51,234,0.2)", filter: "blur(140px)" }}
      />

      {/* Two nested motion wrappers rather than one, and neither of them is the
          tilted element: .vx-card-tilt holds a CSS `transform`, so animating
          the same element's y/scale from framer-motion would overwrite the
          tilt mid-animation. Outer = entrance, middle = the resting drift,
          inner = the tilt. Both motion layers collapse under the page's
          MotionConfig reducedMotion="user". */}
      <motion.div
        initial={{ opacity: 0, y: 34, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-[1]"
      >
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="vx-card-tilt vx-hero-card relative flex flex-col gap-6 rounded-[32px] p-6"
            style={{
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold" style={{ color: "#F8FAFC" }}>
                  Portfolio Overview
                </span>
                <div className="ml-1 flex">
                  {top3.map((a, i) => (
                    <span
                      key={a.symbol}
                      style={{
                        marginLeft: i ? -8 : 0,
                        border: "2px solid rgba(15,23,42,0.9)",
                        borderRadius: "50%",
                      }}
                    >
                      <AssetMark symbol={a.symbol} size={22} />
                    </span>
                  ))}
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: "#6EE7B7",
                  background: "rgba(16,185,129,0.14)",
                }}
              >
                <span className="vx-pulse-dot">
                  <span className="vx-pulse-dot-core" />
                </span>
                Demo · read-only
              </span>
            </div>

            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs" style={{ color: "#94A3B8" }}>
                  Total Capital
                </div>
                <div
                  className="mt-1 font-mono text-[34px] font-extrabold tracking-tight tabular-nums"
                  style={{ color: "#F8FAFC" }}
                >
                  {DEMO_TOTALS.capital}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: "#94A3B8" }}>
                  Realized P&amp;L
                </div>
                <div
                  className="mt-1 font-mono text-[34px] font-extrabold tracking-tight tabular-nums"
                  style={{ color: "#6EE7B7" }}
                >
                  {DEMO_TOTALS.realized}
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl px-3.5 pt-3.5 pb-2"
              style={{
                background: "rgba(2,6,23,0.5)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <MiniChart />
            </div>

            <div className="flex flex-col gap-4">
              {top3.map(h => (
                <AssetRow key={h.symbol} h={h} />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
