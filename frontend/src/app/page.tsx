"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";
import { ArrowRight, Lock, Play, Wallet } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/lib/api";
import LandingNav from "@/components/landing/LandingNav";
import ScrollRail, { type RailSection } from "@/components/landing/ScrollRail";
import SplitHeadline from "@/components/landing/SplitHeadline";
import HeroPreviewCard from "@/components/landing/HeroPreviewCard";
import CardStack from "@/components/landing/CardStack";
import ProductWindow from "@/components/landing/ProductWindow";
import FeatureGrid from "@/components/landing/FeatureGrid";
import SecurityPanel from "@/components/landing/SecurityPanel";
import FaqAccordion from "@/components/landing/FaqAccordion";
import Wordmark from "@/components/landing/Wordmark";

/**
 * Marketing landing page.
 *
 * The auth flows live at /login and /signup; this page only routes people
 * towards them, or into the read-only demo.
 *
 * Two standing constraints this page is built around:
 *
 *  - **Motion is confined here.** Ambient background motion, the tilted
 *    preview card, the scrolling ticker and the rotating asset wheel all live
 *    on this route. Everything behind the auth wall stays calm and instant.
 *
 *  - **No fabricated figures.** There is no "trusted by N users" or "$N
 *    tracked" band, and the numbers in both product previews are the public
 *    demo account's real ones, labelled as such. A product whose entire pitch
 *    is that its figures trace back to real trades cannot open with an
 *    invented one -- including the unflattering ones, which are shown in red
 *    rather than quietly swapped for green.
 *
 * Unlike the rest of the app this route commits to a single dark treatment
 * rather than following the theme, which is why its colours are literal here
 * and in the .vx-* block in globals.css.
 */

const RAIL: RailSection[] = [
  { id: "hero", label: "Overview" },
  { id: "product", label: "Product" },
  { id: "analysis", label: "Capability" },
  { id: "security", label: "Security" },
  { id: "faq", label: "Questions" },
];

/** Mono index + label + hairline rule. The section's top edge. */
function Eyebrow({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className="vx-eyebrow">
      <span className="vx-eyebrow-num">{num}</span>
      {children}
    </div>
  );
}

const FAQ = [
  {
    q: "Do you ever hold my funds?",
    a: "No. VaultX never takes custody. It reads balances and trade history through exchange API keys, and refuses any key that carries withdrawal permission.",
  },
  {
    q: "What does the demo actually show?",
    a: "A shared, seeded account with real price history — full analytics, exports and reports. It is read-only, and the AI advisor is reserved for registered accounts.",
  },
  {
    q: "Where does the AI get its answers?",
    a: "From your own rows: holdings, realised P&L, recent trades and computed risk metrics, passed as context on each question. Every query is filtered by your user id.",
  },
  {
    q: "Is my data isolated from other users?",
    a: "Yes, structurally. Every database query filters on the authenticated user id, so another account's rows are not reachable rather than merely hidden.",
  },
  {
    q: "Is any of this financial advice?",
    a: "No. The optimiser and backtester describe how a portfolio behaved over a historical window. Past behaviour is not a prediction, and nothing here is a recommendation to buy or sell.",
  },
];

/**
 * Section entrance.
 *
 * Replaces the IntersectionObserver-based Reveal component this page used to
 * import. The page was running two reveal mechanisms side by side -- that one
 * for section headings, framer's whileInView for the cards and chips -- which
 * meant two sets of thresholds and two reduced-motion stories for one visual
 * effect. This is the framer one, so everything on the page now reveals
 * through the same path and collapses under the same MotionConfig.
 */
function Rise({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, delay: delay / 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Someone already signed in has no use for a marketing page.
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isLoading, isAuthenticated, router]);

  const startDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const response = await api.auth.guest();
      if (!response?.access_token) throw new Error("No token returned");
      localStorage.setItem("vaultx_token", response.access_token);
      // Full reload rather than router.push: AuthProvider resolves the session
      // once on mount, so a client-side navigation would land on the dashboard
      // with the provider still believing nobody is signed in.
      window.location.href = "/dashboard";
    } catch {
      setDemoError("The demo is unavailable right now. Please try again shortly.");
      setDemoLoading(false);
    }
  };

  return (
    /* MotionConfig: the CSS animations here have their own reduced-motion
       block in globals.css, but framer-motion drives its own animations via
       rAF and ignores that media query entirely. This makes every whileHover /
       whileInView below collapse for a visitor who asked for reduced motion.
       (The scroll-driven card fan needs more than this -- see CardStack.)

       `dark` is deliberate, not a leftover: this route commits to one dark
       treatment, but token-consuming children (the FAQ accordion, the logo)
       would otherwise resolve light-theme tokens for a visitor whose theme is
       light -- white cards on a near-black page. Scoping the subtree to .dark
       redefines those custom properties for everything inside. */
    <MotionConfig reducedMotion="user">
      <div className="vx-landing dark min-h-screen" style={{ color: "#E2E8F0" }}>
        <LandingNav />
        <ScrollRail sections={RAIL} />

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        {/* Twelve columns rather than two equal halves. The copy takes 1-6 and
            the card 8-12, so the two blocks sit at different weights with a
            column of air between them. An even 1fr 1fr split is the most
            common hero layout there is, and it reads as a template. */}
        <section id="hero" className="vx-section pt-[150px]">
          <div className="vx-grid-bg" aria-hidden />
          <div className="vx-container grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10">
            <div className="flex flex-col items-start gap-6 lg:col-span-6">
              {/* The second line was a three-stop violet/blue/cyan gradient.
                  Every landing page in this category has one, and against the
                  serif it read as decoration applied to type rather than as
                  type. A single amber line -- the palette's one warm note --
                  does the same emphasis with a fraction of the noise. */}
              <SplitHeadline
                className="vx-hero-serif font-heading m-0 text-[clamp(42px,5.2vw,68px)] leading-[1.08] font-bold"
                delay={0.15}
              >
                <span className="block" style={{ color: "#FFFFFF" }}>
                  Analyze your crypto.
                </span>
                <span className="block" style={{ color: "var(--vx-accent)" }}>
                  Don&apos;t just watch it.
                </span>
              </SplitHeadline>

              <p
                className="vx-hero-serif m-0 max-w-[580px] text-[21px] leading-[1.7]"
                style={{ color: "var(--vx-ink-dim)" }}
              >
                Gain performance insights and true cost basis from your real trade history. An
                analytical layer, not just a balance tracker.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/signup">
                  <button className="vx-cta-primary">
                    <Wallet className="h-4 w-4" />
                    Get started free
                    <ArrowRight className="vx-cta-arrow h-4 w-4" />
                  </button>
                </Link>
                <button
                  type="button"
                  className="vx-cta-secondary"
                  onClick={startDemo}
                  disabled={demoLoading}
                >
                  <Play className="h-4 w-4" />
                  {demoLoading ? "Opening demo…" : "See it work"}
                </button>
              </div>

              <span
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: "var(--vx-ink-faint)" }}
              >
                <Lock className="h-3 w-3" />
                Non-custodial and read-only. VaultX never moves your funds.
              </span>

              {demoError && (
                <p className="m-0 text-sm" style={{ color: "#F87171" }} role="alert">
                  {demoError}
                </p>
              )}
            </div>

            <div className="lg:col-span-5 lg:col-start-8">
              <HeroPreviewCard />
            </div>
          </div>
        </section>

        {/* ── Scroll-driven card fan ──────────────────────────────────────── */}
        <CardStack />

        {/* ── Product window ──────────────────────────────────────────────── */}
        <section id="product" className="vx-section">
          <div className="vx-grid-bg" aria-hidden />
          <div
            className="vx-orb vx-orb-drift-a"
            aria-hidden
            style={{
              top: "10%",
              left: "8%",
              width: 500,
              height: 500,
              background: "rgba(79,70,229,0.25)",
              filter: "blur(120px)",
            }}
          />
          <div
            className="vx-orb vx-orb-drift-b"
            aria-hidden
            style={{
              top: "5%",
              right: "8%",
              width: 450,
              height: 450,
              background: "rgba(8,145,178,0.2)",
              filter: "blur(140px)",
            }}
          />

          <div className="vx-container">
            <Eyebrow num="01">Product</Eyebrow>
            {/* Heading left-aligned against the rule above it rather than
                centred. Six centred headings in a row was most of why the page
                read as one undifferentiated column. */}
            <h2 className="vx-preview-headline font-heading vx-reading m-0 mb-10 pb-1 text-[clamp(30px,4.5vw,44px)] leading-[1.15] font-bold">
              See what your portfolio is actually doing
            </h2>
            <ProductWindow onLaunchDemo={startDemo} loading={demoLoading} />
          </div>
        </section>

        {/* ── Capabilities: the light act ─────────────────────────────────── */}
        {/* The one inverted section on the page. Everything from the nav to the
            footer was dark, so no section carried more weight than any other;
            flipping this one splits the scroll into two acts and gives the
            capability list the register of a printed spec sheet rather than a
            sixth panel of glass.

            No grid and no orbs here either -- the ambient treatment is reserved
            for the hero, the card fan and the product window, which is what
            lets those three read as the emphasis they were meant to be. */}
        <section id="analysis" className="vx-section vx-act-light">
          <div className="vx-container">
            <Rise>
              <Eyebrow num="02">Capability</Eyebrow>
              <div className="mb-12 grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
                <h2
                  className="font-heading m-0 text-[clamp(36px,5vw,52px)] leading-[1.08] font-bold lg:col-span-7"
                  style={{ color: "var(--vx-ink)" }}
                >
                  Depth, not breadth
                </h2>
                <p
                  className="m-0 text-[17px] leading-relaxed lg:col-span-4 lg:col-start-9"
                  style={{ color: "var(--vx-ink-dim)" }}
                >
                  Other trackers count your wallets. VaultX understands them.
                </p>
              </div>
            </Rise>
            {/* No Rise wrapper on the grid: each row runs its own staggered
              whileInView entrance, and fading the block in first would delay
              and flatten that stagger. */}
            <FeatureGrid />
          </div>
        </section>

        {/* ── Security ────────────────────────────────────────────────────── */}
        <section id="security" className="vx-section">
          <div className="vx-container">
            <Eyebrow num="03">Security</Eyebrow>
            <SecurityPanel />
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section id="faq" className="vx-section">
          <div className="vx-container">
            <Eyebrow num="04">Questions</Eyebrow>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
              <Rise className="lg:col-span-4">
                <h2
                  className="font-heading m-0 text-[clamp(30px,4vw,42px)] leading-[1.1] font-bold"
                  style={{ color: "var(--vx-ink)" }}
                >
                  Questions,
                  <br />
                  answered plainly
                </h2>
              </Rise>
              {/* The accordion carries the section on its own; a centred
                  heading above it would have been a fifth in a row. */}
              <Rise delay={60} className="lg:col-span-7 lg:col-start-6">
                <FaqAccordion items={FAQ} />
              </Rise>
            </div>
          </div>
        </section>

        {/* ── Closing CTA ─────────────────────────────────────────────────── */}
        <section className="vx-section text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(99,102,241,0.18), transparent 70%)",
            }}
          />
          <Rise className="relative z-[1]">
            <h2
              className="font-heading mx-auto m-0 max-w-[640px] text-[clamp(30px,4vw,44px)] leading-[1.12] font-bold"
              style={{ color: "var(--vx-ink)" }}
            >
              See it running before you sign up
            </h2>
            <p
              className="mx-auto mt-5 max-w-[520px] text-lg leading-relaxed"
              style={{ color: "var(--vx-ink-dim)" }}
            >
              The demo is a seeded account with real price history — the same analytics you would
              get on your own portfolio.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                className="vx-cta-primary"
                onClick={startDemo}
                disabled={demoLoading}
              >
                {demoLoading ? "Opening demo…" : "Explore the live demo"}
                <ArrowRight className="vx-cta-arrow h-4 w-4" />
              </button>
              <Link href="/signup">
                <button className="vx-cta-secondary">Create an account</button>
              </Link>
            </div>
          </Rise>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer
          className="relative flex flex-wrap items-center gap-6 py-10 text-[13px]"
          style={{
            paddingInline: "var(--vx-gutter)",
            borderTop: "1px solid var(--vx-line)",
            color: "var(--vx-ink-dim)",
          }}
        >
          {/* The footer is the one surface with room for the full lockup, so it
              carries the tagline the nav has no vertical space for. */}
          <Wordmark size="sm" tagline />

          <span>Non-custodial crypto portfolio analytics.</span>
          <span className="ml-auto flex items-center gap-[18px]">
            <a href="#product" className="vx-footer-link">
              Product
            </a>
            <a href="#security" className="vx-footer-link">
              Security
            </a>
            <Link href="/login" className="vx-footer-link">
              Sign in
            </Link>
          </span>
          <p className="w-full text-xs" style={{ color: "var(--vx-ink-faint)" }}>
            © {new Date().getFullYear()} VaultX. Analytics and backtests are historical, not
            predictions or financial advice.
          </p>
        </footer>
      </div>
    </MotionConfig>
  );
}
