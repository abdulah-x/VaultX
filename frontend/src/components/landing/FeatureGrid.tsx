"use client";

import { motion } from "framer-motion";
import { Calculator, Target, Repeat, Sparkles, Plug, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The six capability entries, set as a specification sheet rather than as
 * cards.
 *
 * These were six blurred glass panels with gradient icon chips -- the same
 * treatment as the hero card, the product window and the security panel, so
 * by this point in the scroll it had stopped meaning anything. As a numbered
 * list under hairline rules they read as a spec table in a printed report,
 * which is the register the page's Times display face is already in, and they
 * stop competing with the product surfaces above them.
 *
 * Every colour here is an ink token, so the whole block inverts with its
 * section (see .vx-act-light). The old literal #F8FAFC / #94A3B8 could not.
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

function FeatureRow({ f, index }: { f: Feature; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
      className="vx-spec-row"
    >
      <div className="vx-spec-head">
        <span className="vx-spec-num">{String(index + 1).padStart(2, "0")}</span>
        <f.icon className="vx-spec-icon" />
        <h3 className="vx-spec-title font-heading">{f.title}</h3>
      </div>
      <p className="vx-spec-body">{f.body}</p>
      {f.badge && <span className="vx-spec-badge">{f.badge}</span>}
    </motion.div>
  );
}

export default function FeatureGrid() {
  return (
    <div className="vx-spec-grid">
      {FEATURES.map((f, i) => (
        <FeatureRow key={f.title} f={f} index={i} />
      ))}
    </div>
  );
}
