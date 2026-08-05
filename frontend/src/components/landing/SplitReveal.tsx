"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

/**
 * Scroll-triggered sibling of SplitHeadline, for every heading below the
 * fold. The hero's version plays on mount because it's the first thing a
 * visitor sees; every other heading on the page reveals as it's scrolled to
 * instead, which is what `once: true` on the ScrollTrigger buys over a fixed
 * mount-time delay -- the effect fires when the visitor actually reaches it,
 * not on a timer relative to page load.
 *
 * Word-by-word, from behind a line mask -- see SplitHeadline for why this
 * needs GSAP rather than framer, and why it waits on document.fonts.ready
 * before measuring (Fraunces is a downloaded webfont; splitting against the
 * fallback would compute the wrong line breaks and reflow once it swaps in).
 */
export default function SplitReveal({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const splitRef = useRef<InstanceType<typeof SplitText> | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      const el = ref.current;
      if (!el) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const run = contextSafe!(() => {
        const split = new SplitText(el, {
          type: "words,lines",
          mask: "lines",
          autoSplit: true,
        });
        splitRef.current = split;

        gsap.from(split.words, {
          yPercent: 118,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.04,
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            once: true,
          },
        });
      });

      document.fonts.ready.then(run);

      return () => {
        splitRef.current?.revert();
        splitRef.current = null;
      };
    },
    { scope: ref },
  );

  return (
    <h2 ref={ref} className={className} style={style}>
      {children}
    </h2>
  );
}
