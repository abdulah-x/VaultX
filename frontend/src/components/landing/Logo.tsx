"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The VaultX symbolic mark: a vault-hex frame around a three-node network
 * triangle -- a nod to on-chain, decentralized custody.
 *
 * Replaces the earlier shield-and-V glyph. Per the brand guideline, the
 * cyan-to-violet gradient is reserved for this icon and the "X" in the
 * wordmark; nothing else on the page may use it as a fill.
 *
 * The gradient id is derived from useId rather than hardcoded, because the
 * mark renders more than once per page (nav and footer). Two SVGs sharing a
 * literal id would be invalid markup, and both would resolve against whichever
 * definition the document happened to parse first.
 *
 * The landing page is the one place in the app allowed heavier motion, so this
 * keeps a small personality tick -- a tilt-and-lift on hover -- instead of
 * sitting inert like the rest of the app's static UI.
 */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const gradientId = `vx-mark-${useId()}`;

  return (
    <motion.div
      className={`relative shrink-0 ${className}`}
      whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: -6 }}
      whileTap={reduceMotion ? undefined : { scale: 0.94, rotate: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="vx-mark h-full w-full"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="4"
            y1="4"
            x2="44"
            y2="44"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>

        {/* Vault-hex frame */}
        <path
          d="M24 3 L43 13.5 V34.5 L24 45 L5 34.5 V13.5 Z"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
        />
        {/* Three-node network triangle */}
        <path
          d="M15 30 L24 15 L33 30 Z"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="15" r="2.8" fill={`url(#${gradientId})`} />
        <circle cx="15" cy="30" r="2.8" fill={`url(#${gradientId})`} />
        <circle cx="33" cy="30" r="2.8" fill={`url(#${gradientId})`} />
      </svg>
    </motion.div>
  );
}
