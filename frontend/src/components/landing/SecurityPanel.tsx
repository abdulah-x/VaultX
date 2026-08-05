"use client";

import { motion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";
import SplitReveal from "./SplitReveal";

/**
 * The security panel. Each claim below is enforced in code, not aspirational:
 * keys are Fernet-encrypted before storage, withdrawal-capable keys are
 * rejected at connect time, and every database query filters on the
 * authenticated user id.
 *
 * The guarantees render as inline chips rather than a stacked column of
 * cards, so they read as a set of properties beside the copy instead of
 * competing with it as a second panel.
 */

const BENEFITS: { text: string; tone?: "alert" }[] = [
  { text: "Read-only keys enforced" },
  { text: "Withdrawal permission refused", tone: "alert" },
  { text: "Funds never custodied" },
  { text: "Keys encrypted before storage" },
];

function BenefitChip({ text, tone, delay }: { text: string; tone?: "alert"; delay: number }) {
  const isAlert = tone === "alert";
  const color = isAlert ? "#F87171" : "#34D399";
  const Ico = isAlert ? Lock : ShieldCheck;

  return (
    <motion.span
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: delay / 1000 }}
      whileHover={{ scale: 1.06, y: -2 }}
      whileTap={{ scale: 0.94 }}
      className="vx-benefit-chip inline-flex items-center gap-2 rounded-full py-[9px] pr-4 pl-2.5"
      style={{
        background: "rgba(15,23,42,0.7)",
        border: `1px solid ${isAlert ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <span
        className="vx-benefit-icon inline-flex h-[26px] w-[26px] min-w-[26px] items-center justify-center rounded-full"
        style={{
          background: `${color}1F`,
          border: `1px solid ${color}40`,
          color,
          boxShadow: `0 0 14px ${color}33`,
        }}
      >
        <Ico className="h-[13px] w-[13px]" />
      </span>
      <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: "#F8FAFC" }}>
        {text}
      </span>
    </motion.span>
  );
}

export default function SecurityPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6 }}
      className="relative mx-auto max-w-[1040px]"
    >
      <div
        className="vx-security-tilt vx-security-glow relative z-[1] overflow-hidden rounded-3xl"
        style={{
          background: "rgba(255,255,255,0.01)",
          border: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          boxShadow: "0 30px 70px -20px rgba(0,0,0,0.8)",
        }}
      >
        <div className="vx-security-sheen" aria-hidden />
        <div
          className="vx-security-grid relative grid items-center gap-10 p-11"
          style={{ gridTemplateColumns: "1.2fr 1fr" }}
        >
          <div className="flex flex-col items-start gap-[18px]">
            <span className="vx-security-badge">
              <span className="vx-pulse-dot">
                <span className="vx-pulse-dot-core" />
              </span>
              Security by design
            </span>
            <SplitReveal
              className="font-heading m-0 text-[clamp(28px,4vw,34px)] font-extrabold tracking-[-0.03em]"
              style={{ color: "#F8FAFC" }}
            >
              We can read. We can&apos;t touch.
            </SplitReveal>
            <p className="m-0 text-base leading-[1.65]" style={{ color: "#94A3B8" }}>
              VaultX connects with read-only exchange API keys. Any key carrying withdrawal or trade
              permission is refused at connect time — checked before anything is stored, and what is
              stored is encrypted at rest.
            </p>
            <a href="#product" className="vx-security-cta">
              See how it works
              <span aria-hidden>→</span>
            </a>
          </div>
          <div className="flex flex-wrap content-start gap-2.5">
            {BENEFITS.map((b, i) => (
              <BenefitChip key={b.text} text={b.text} tone={b.tone} delay={i * 90} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
