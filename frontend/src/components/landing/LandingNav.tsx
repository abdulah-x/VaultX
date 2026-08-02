"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import Wordmark from "./Wordmark";

/**
 * Floating glass header for the marketing page.
 *
 * The links are in-page anchors rather than routes: VaultX has no marketing
 * sub-pages, and a nav item that 404s is worse than one that scrolls. There is
 * deliberately no "Pricing" entry either -- there is no pricing to link to.
 */

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "Analysis", href: "#analysis" },
  { label: "Security", href: "#security" },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 top-0 z-50 px-4 py-3">
      <header
        className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-2xl px-6 py-3"
        style={{
          background: "rgba(2,6,23,0.7)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <Link href="/" className="no-underline" aria-label="VaultX home">
          <Wordmark size="md" />
        </Link>

        <nav className="vx-nav-links flex gap-1">
          {LINKS.map(l => (
            <a key={l.label} href={l.href} className="vx-nav-link">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="vx-nav-actions flex items-center gap-2.5">
          <Link href="/login" className="vx-nav-signin">
            Sign in
          </Link>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              className="vx-cta-primary"
              style={{
                padding: "9px 16px",
                fontSize: 14,
                boxShadow: "0 0 20px rgba(99,102,241,0.35)",
              }}
            >
              Get started
              <ArrowRight className="vx-cta-arrow h-4 w-4" />
            </motion.button>
          </Link>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          className="vx-nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </motion.button>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mx-auto mt-2 flex max-w-[1280px] flex-col gap-1 overflow-hidden rounded-2xl p-4"
            style={{
              background: "rgba(2,6,23,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            {LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="vx-nav-link"
                style={{ padding: "10px 12px" }}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex items-center gap-2.5">
              <Link href="/login" className="vx-nav-signin">
                Sign in
              </Link>
              <Link href="/signup">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="vx-cta-primary"
                  style={{ padding: "9px 16px", fontSize: 14 }}
                >
                  Get started
                  <ArrowRight className="vx-cta-arrow h-4 w-4" />
                </motion.button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
