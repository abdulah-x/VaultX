"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";

/**
 * Ambient background layer for the hero, sitting behind the headline and the
 * 3D orb (HeroVisual) rather than competing with either. The brief was "like
 * a video call where something is quietly happening in the background" --
 * so nothing here should ever pull focus off the headline/CTAs in front of it.
 *
 * Two animation systems, deliberately split by what each is good at:
 *  - GSAP drives the candle rain: a couple dozen independently-timed DOM
 *    nodes on infinite, staggered timelines. This is GSAP's home turf --
 *    imperative, many-instance, fire-and-forget looping.
 *  - Framer Motion drives the two large gradient blobs: a handful of
 *    declarative, physics-eased loops, consistent with how the rest of this
 *    page already uses Framer Motion for its reveals.
 *
 * Both are skipped entirely under prefers-reduced-motion, same gate as
 * HeroVisual next to it.
 */

const CANDLE_COUNT = 26;

interface Candle {
  left: number; // percent
  width: number; // px
  height: number; // px
  bullish: boolean;
  duration: number; // seconds for one rise-and-fade cycle
  delay: number;
}

export default function MarketPulseBackground() {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Randomized once per mount, not per render -- GSAP owns these nodes after
  // the first effect run and re-generating positions would fight it.
  const candles = useMemo<Candle[]>(() => {
    return Array.from({ length: CANDLE_COUNT }, () => ({
      left: Math.random() * 100,
      width: 3 + Math.random() * 4,
      height: 24 + Math.random() * 64,
      bullish: Math.random() > 0.45,
      duration: 9 + Math.random() * 7,
      delay: Math.random() * 10,
    }));
  }, []);

  useEffect(() => {
    if (reduceMotion || !containerRef.current) return;

    const ctx = gsap.context(() => {
      const bars = gsap.utils.toArray<HTMLElement>(".pulse-candle");
      bars.forEach((bar) => {
        const duration = Number(bar.dataset.duration);
        const delay = Number(bar.dataset.delay);

        // One keyframed tween per bar rather than fromTo+onRepeat: a fresh
        // tween fired from onRepeat could overlap the tail of the one it was
        // replacing and fight it for a frame. Keyframes loop cleanly on
        // their own via repeat: -1.
        gsap.to(bar, {
          keyframes: {
            "0%": { y: 30, opacity: 0 },
            "15%": { opacity: 0.55 },
            "70%": { opacity: 0.5 },
            "100%": { y: -170, opacity: 0 },
          },
          duration,
          delay,
          ease: "sine.inOut",
          repeat: -1,
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[46rem] overflow-hidden"
    >
      {/* Two slow-drifting gradient blobs -- Framer Motion, declarative loop */}
      <motion.div
        className="from-primary/25 absolute top-10 left-[15%] h-72 w-72 rounded-full bg-gradient-to-br to-transparent blur-3xl"
        animate={{ x: [0, 40, -20, 0], y: [0, 30, -10, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="from-vaultx-accent/20 absolute top-32 right-[12%] h-80 w-80 rounded-full bg-gradient-to-br to-transparent blur-3xl"
        animate={{ x: [0, -30, 20, 0], y: [0, -20, 15, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Candle rain -- GSAP, many independently-timed instances */}
      {candles.map((c, i) => (
        <div
          key={i}
          className={`pulse-candle absolute bottom-0 rounded-sm ${
            c.bullish ? "bg-vaultx-success/70" : "bg-vaultx-danger/70"
          }`}
          data-duration={c.duration}
          data-delay={c.delay}
          style={{ left: `${c.left}%`, width: c.width, height: c.height }}
        />
      ))}
    </div>
  );
}
