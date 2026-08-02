"use client";

import { useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Fixed section index down the left gutter.
 *
 * The page is a long scroll with no indication of where you are in it or how
 * much is left. This is the printed-report answer to that -- a running index
 * rather than a progress bar, which tells you what the sections are as well as
 * how far along you are.
 *
 * Hidden below 1280px in CSS, where there is no gutter to put it in. It is
 * aria-hidden and pointer-events: none: it duplicates the header nav, so
 * exposing it to a screen reader would just read the same list twice.
 */

export interface RailSection {
  id: string;
  label: string;
}

export default function ScrollRail({ sections }: { sections: RailSection[] }) {
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      // No scope: the triggers reference page sections that live outside this
      // component, so a scoped selector would match nothing. ScrollTriggers
      // created inside useGSAP are still reverted on unmount by its context.
      sections.forEach((s, i) => {
        ScrollTrigger.create({
          trigger: `#${s.id}`,
          // Midpoint of the viewport: a section counts as current once it has
          // crossed the middle of the screen, not the moment its top edge
          // appears. Otherwise the index runs a whole section ahead of what
          // is actually being read.
          start: "top 50%",
          end: "bottom 50%",
          onToggle: self => {
            if (self.isActive) setActive(i);
          },
        });
      });
    },
    { dependencies: [sections] },
  );

  return (
    <div className="vx-rail" aria-hidden>
      {sections.map((s, i) => (
        <span key={s.id} className="vx-rail-item" data-active={i === active}>
          <span className="vx-rail-tick" />
          {s.label}
        </span>
      ))}
    </div>
  );
}
