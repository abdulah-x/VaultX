"use client";

import { ChevronDown } from "lucide-react";

/**
 * FAQ built on <details>/<summary>.
 *
 * Native disclosure gives keyboard operation, the correct expanded/collapsed
 * semantics and in-page find-on-page for free -- all of which a div-with-
 * onClick would have to reimplement, usually incompletely. `name` makes the
 * group behave as an accordion (opening one closes the others) without any
 * state; browsers that don't support it simply allow several open at once,
 * which is a fine outcome rather than a broken one.
 */

interface FaqItem {
  q: string;
  a: string;
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {items.map(item => (
        <details
          key={item.q}
          name="vaultx-faq"
          className="group border-border bg-card hover:border-ring/40 rounded-xl border transition-colors"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="text-muted-foreground px-5 pb-5 text-sm leading-relaxed">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
