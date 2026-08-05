"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, SplitText);

/**
 * Headline that reveals word by word from behind a line mask.
 *
 * framer-motion has no equivalent -- doing this with it means hand-splitting
 * the string into spans and animating forty elements yourself, and the split
 * has to be redone whenever the line breaks change. SplitText re-splits on
 * resize and reverts the DOM cleanly, which is the whole reason GSAP is on
 * this page at all.
 *
 * `mask: "lines"` wraps each line in an overflow-hidden parent, so words rise
 * out of nothing rather than fading in over the background. That reads as
 * type being set rather than as content loading.
 *
 * The heading is set in Fraunces, a downloaded webfont, so splitting has to
 * wait on document.fonts.ready first -- splitting against the fallback would
 * measure the wrong line breaks and word widths, then visibly reflow once
 * Fraunces swaps in.
 */
export default function SplitHeadline({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const splitRef = useRef<SplitText | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      const el = ref.current;
      if (!el) return;

      // GSAP drives this from rAF and never consults the media query itself,
      // so the page's reduced-motion CSS block does not cover it. Bail out
      // entirely rather than shortening the duration: the effect is motion.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // Split and animate only run once Fraunces is actually loaded --
      // splitting against the fallback font's metrics would compute the
      // wrong line breaks and word widths, then visibly reflow once the
      // webfont swaps in. document.fonts.ready resolves after every @font-face
      // referenced on the page has loaded, or immediately if that already
      // happened before this effect ran.
      //
      // The callback runs after useGSAP's own synchronous pass, so it isn't
      // part of the effect's gsap context automatically -- contextSafe wraps
      // it so the tween and SplitText it creates are still reverted on
      // unmount rather than leaking.
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
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.045,
          delay,
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
    <h1 ref={ref} className={className}>
      {children}
    </h1>
  );
}
