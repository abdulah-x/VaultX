"use client";

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ShieldCheck } from "lucide-react";
import AssetMark from "./AssetMark";
import { DEMO_HOLDINGS, DEMO_TOTALS, DEMO_SERIES } from "./demoData";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll-driven fanned card stack, pinned with ScrollTrigger.
 *
 * This was a hand-rolled pin: a section with an explicit 180vh height and a
 * position:sticky inner panel, with framer's useScroll mapping progress onto
 * the fan. It worked, but the height was a magic number tuned by eye -- change
 * the card content or add a fourth card and the fan finished early or late,
 * with no error to tell you.
 *
 * ScrollTrigger derives the scroll distance from the choreography instead
 * (85% of a viewport per card transition) and builds the pin spacer itself, so
 * the section is exactly as tall as the animation needs.
 *
 * Under prefers-reduced-motion the whole mechanism is dropped -- the section
 * collapses to its natural height and the three cards render as a plain static
 * row. Neither MotionConfig nor the CSS reduced-motion block would cover this:
 * both suppress *animations*, while a scroll-bound pin keeps consuming scroll
 * distance regardless, leaving a screen of unexplained empty page.
 */

const CARDS = [
  {
    key: "basis",
    title: "Know what you paid",
    sub: "Moving-average cost basis, replayed from real trades.",
  },
  {
    key: "analyze",
    title: "Analyze deeply",
    sub: "Real cost basis, not a spot guess.",
  },
  {
    key: "verify",
    title: "Verify, don't trust",
    sub: "Read-only keys. Funds never touched.",
  },
] as const;

/** Cost basis against market price -- the one figure a balance aggregator
 *  cannot show you, because it requires replaying the trade history rather
 *  than reading a spot balance. Deliberately not another allocation view:
 *  the hero card above already covers allocation. */
function CardBasis() {
  return (
    <>
      <div className="flex items-center justify-between text-[10px] tracking-[0.05em] uppercase">
        <span style={{ color: "#64748B" }}>Asset</span>
        <span style={{ color: "#64748B" }}>Paid → now</span>
      </div>
      <div className="flex flex-col gap-3">
        {DEMO_HOLDINGS.slice(0, 3).map(h => (
          <div key={h.symbol} className="flex items-center gap-2.5">
            <AssetMark symbol={h.symbol} size={24} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold" style={{ color: "#E2E8F0" }}>
                {h.symbol}
              </div>
              <div className="font-mono text-[10.5px] tabular-nums" style={{ color: "#64748B" }}>
                {h.avgCost} → {h.marketPrice}
              </div>
            </div>
            <span
              className="font-mono text-[11.5px] font-semibold tabular-nums"
              style={{ color: h.up ? "#6EE7B7" : "#F87171" }}
            >
              {h.pnlPct}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto text-[11.5px]" style={{ color: "#64748B" }}>
        Averaged across every buy and sell, in order.
      </div>
    </>
  );
}

function CardAnalyze() {
  const max = Math.max(...DEMO_SERIES);
  return (
    <>
      <div>
        <div className="text-[11px]" style={{ color: "#64748B" }}>
          Unrealized vs cost basis
        </div>
        <div
          className="mt-0.5 font-mono text-[22px] font-bold tabular-nums"
          style={{ color: "#F87171" }}
        >
          {DEMO_TOTALS.unrealizedPct}
        </div>
      </div>
      <div className="vx-bar-track" style={{ height: 90 }}>
        {DEMO_SERIES.slice(-7).map((v, i) => (
          <span
            key={i}
            className="vx-bar"
            style={{ flex: 1, height: `${Math.max(6, (v / max) * 100)}%`, background: "#22D3EE" }}
          />
        ))}
      </div>
      <div className="mt-auto text-[11.5px]" style={{ color: "#64748B" }}>
        Replayed from your real trades, not a snapshot.
      </div>
    </>
  );
}

function CardVerify() {
  return (
    <>
      <span
        className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-[14px]"
        style={{
          background: "rgba(52,211,153,0.12)",
          border: "1px solid rgba(52,211,153,0.3)",
          color: "#6EE7B7",
        }}
      >
        <ShieldCheck className="h-6 w-6" />
      </span>
      <div className="mt-1 flex flex-col gap-2">
        {["Read-only keys enforced", "Withdrawal permission refused", "Funds never custodied"].map(
          t => (
            <div
              key={t}
              className="flex items-center gap-2 text-[12.5px]"
              style={{ color: "#CBD5E1" }}
            >
              <span className="h-[5px] w-[5px] rounded-full" style={{ background: "#34D399" }} />
              {t}
            </div>
          ),
        )}
      </div>
    </>
  );
}

const RENDER = { basis: CardBasis, analyze: CardAnalyze, verify: CardVerify };

function CardBody({ c }: { c: (typeof CARDS)[number] }) {
  const Inner = RENDER[c.key];
  return (
    <>
      <div
        className="text-[11px] font-semibold tracking-[0.06em] uppercase"
        style={{ color: "#94A3B8" }}
      >
        {c.title}
      </div>
      <Inner />
    </>
  );
}

export default function CardStack() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced || !sectionRef.current || !pinRef.current) return;

      const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];

      /** Fan geometry for a given fractional card index. */
      const layout = (v: number) => {
        cards.forEach((el, i) => {
          const offset = i - v;
          const away = Math.abs(offset);
          gsap.set(el, {
            x: offset * 64,
            y: away * 14,
            rotate: offset * 7,
            scale: 1 - Math.min(away, 1) * 0.07,
            opacity: away > 1.4 ? 0 : 1,
            zIndex: Math.round(10 - away),
          });
        });
      };

      layout(0);

      const state = { i: 0 };
      gsap.to(state, {
        i: CARDS.length - 1,
        ease: "none",
        onUpdate: () => layout(state.i),
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          // Scroll distance is expressed per card rather than as a fixed
          // section height. The old version was a hand-tuned 180vh, which
          // meant adding a fourth card silently made the fan finish early.
          end: `+=${(CARDS.length - 1) * 85}%`,
          pin: pinRef.current,
          pinSpacing: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
    },
    { dependencies: [reduced], scope: sectionRef },
  );

  const heading = (
    <div className="relative mx-auto mb-2 max-w-[640px] text-center">
      <h2
        className="font-heading m-0 pb-1 text-[clamp(28px,4vw,38px)] leading-[1.3] font-bold"
        style={{ color: "var(--vx-ink)" }}
      >
        One view. Every angle.
      </h2>
      <p className="mt-2.5 mb-0 text-base" style={{ color: "var(--vx-ink-dim)" }}>
        {reduced
          ? "Three things VaultX does that a balance tracker doesn't."
          : "Keep scrolling — the stack follows."}
      </p>
    </div>
  );

  if (reduced) {
    return (
      <section className="relative px-6 py-16 md:px-10">
        <div className="vx-grid-bg" aria-hidden />
        {heading}
        <div className="vx-fan-wrap vx-fan-wrap-static mt-8">
          {CARDS.map(c => (
            <div key={c.key} className="vx-fan-card">
              <CardBody c={c} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative">
      <div
        ref={pinRef}
        className="flex h-screen flex-col items-center overflow-hidden px-6 pt-[130px] pb-10 md:px-10"
      >
        <div className="vx-grid-bg" aria-hidden />
        {heading}
        <div className="vx-fan-wrap">
          {CARDS.map((c, i) => (
            <div
              key={c.key}
              ref={el => {
                cardsRef.current[i] = el;
              }}
              className="vx-fan-card"
            >
              <CardBody c={c} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
