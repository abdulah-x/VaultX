"use client";

import { motion } from "framer-motion";
import { Calculator, Target, Repeat, Sparkles, Plug, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The six capability cards.
 *
 * Each claim is one this build actually satisfies -- moving-average cost basis
 * from real trades, the MPT optimizer, the DCA backtester, the RAG advisor, the
 * Binance WebSocket -> Redis -> TimescaleDB pipeline, and the read-only key
 * policy. Nothing here describes a feature that does not exist.
 */

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: string;
}

const FEATURES: Feature[] = [
  {
    icon: Calculator,
    title: "Real cost basis",
    body: "Cost basis and realised P&L are replayed from your actual trade history, chronologically — not estimated from a spot snapshot.",
  },
  {
    icon: Target,
    title: "MPT optimizer",
    body: "Maximum-Sharpe allocation weights solved from 90 days of real daily returns, shown beside your current allocation.",
  },
  {
    icon: Repeat,
    title: "DCA backtester",
    body: "Simulate daily, weekly, biweekly or monthly buys against real historical prices — with the lump-sum baseline reported even when it wins.",
    badge: "Historical simulation",
  },
  {
    icon: Sparkles,
    title: "Grounded advisor",
    body: "An LLM that answers from your own holdings, trades and risk metrics, retrieved at question time — so it cannot invent a position you do not own.",
    badge: "LLM-powered",
  },
  {
    icon: Plug,
    title: "Real-time prices",
    body: "A Binance WebSocket feed streams through Redis into a TimescaleDB hypertable, so history is real market data rather than a polled sample.",
  },
  {
    icon: ShieldCheck,
    title: "Non-custodial",
    body: "Read-only keys only. Any key carrying withdrawal permission is refused at connect time, and VaultX never holds funds.",
  },
];

function FeatureCard({ f, index }: { f: Feature; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="vx-feature-card relative flex flex-col gap-4 rounded-2xl p-6"
      style={{
        background: "rgba(2,6,23,0.6)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="vx-feature-spotlight rounded-2xl" aria-hidden />
      {f.badge && <span className="vx-feature-badge">{f.badge}</span>}
      <span
        className="vx-feature-icon-wrap relative inline-flex h-12 w-12 items-center justify-center rounded-xl"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.1))",
          border: "1px solid rgba(139,92,246,0.3)",
          color: "#C4B5FD",
          boxShadow: "0 0 15px rgba(139,92,246,0.15)",
        }}
      >
        <f.icon className="h-5 w-5" />
      </span>
      <div
        className="vx-feature-title font-heading text-lg font-bold tracking-[-0.01em]"
        style={{ color: "#F8FAFC" }}
      >
        {f.title}
      </div>
      <div className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
        {f.body}
      </div>
    </motion.div>
  );
}

export default function FeatureGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, i) => (
        <FeatureCard key={f.title} f={f} index={i} />
      ))}
    </div>
  );
}
