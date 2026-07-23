"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * The boundary between the marketing page and three.js.
 *
 * `ssr: false` is not optional here: the scene touches WebGL and `window`, and
 * pre-rendering it on the server would throw. It also keeps three.js in its own
 * lazily-fetched chunk rather than the shared bundle.
 */
const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <HeroFallback />,
});

/** Shown while the scene loads, and permanently for anyone who should not get
 *  it at all. Deliberately a plain CSS gradient -- no canvas, no JS. */
function HeroFallback() {
  return (
    <div
      aria-hidden
      className="from-vaultx-primary/25 via-vaultx-secondary/15 h-full w-full rounded-full bg-gradient-to-br to-transparent blur-2xl"
    />
  );
}

export default function HeroVisual() {
  // Two independent reasons to skip the scene:
  //  - the visitor asked for reduced motion, and a continuously rotating object
  //    is exactly what that setting is about;
  //  - the device reports few cores, where a WebGL canvas costs more than it
  //    gives. navigator.hardwareConcurrency is a coarse signal, but it is the
  //    only one available without measuring frames and reacting late.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const weakDevice = (navigator.hardwareConcurrency ?? 8) <= 2;
    setEnabled(!reduced && !weakDevice);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="h-[520px] w-[520px] max-w-full">
        {enabled ? <HeroScene /> : <HeroFallback />}
      </div>
    </div>
  );
}
