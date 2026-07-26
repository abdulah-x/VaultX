"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * The real VaultX mark (shield + "V"), not the generic bar-chart glyph the
 * nav used before. Inlined rather than <img src="/icon.svg"> so the gradient
 * and stroke can be driven by CSS/framer-motion on hover.
 *
 * The landing page is the one place in the app allowed heavier motion (see
 * page.tsx's note on motion being confined to landing + hero + marquee), so
 * this gets a small personality tick -- a tilt-and-lift on hover -- instead
 * of sitting completely inert like the rest of the app's static UI.
 */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`relative shrink-0 ${className}`}
      whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: -6 }}
      whileTap={reduceMotion ? undefined : { scale: 0.94, rotate: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      {/* Soft glow behind the mark -- only visible on hover, keeps it calm at rest */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] opacity-0 blur-md"
        whileHover={reduceMotion ? undefined : { opacity: 0.55 }}
      />

      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
        <defs>
          <linearGradient id="vaultx-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <radialGradient id="vaultx-logo-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </radialGradient>
        </defs>

        <circle cx="16" cy="16" r="16" fill="url(#vaultx-logo-bg)" />
        <path
          d="M16 4L12 6V12C12 16.5 14.5 20.26 18 21.22C21.5 20.26 24 16.5 24 12V6L20 4L16 4Z"
          fill="url(#vaultx-logo-gradient)"
        />
        <path
          d="M16 6L13.5 7.5V12C13.5 15.5 15.2 18.4 17.5 19.1C19.8 18.4 21.5 15.5 21.5 12V7.5L19 6L16 6Z"
          fill="white"
          fillOpacity="0.2"
        />
        <path
          d="M14 10L16 15L18 10"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </motion.div>
  );
}
