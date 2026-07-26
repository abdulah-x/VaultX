"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Brain,
  LineChart,
  Lock,
  PieChart,
  Repeat,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ThemeToggle from "@/components/ui/ThemeToggle";
import HeroVisual from "@/components/landing/HeroVisual";
import Logo from "@/components/landing/Logo";
import ProductPreview from "@/components/landing/ProductPreview";
import AssetMarquee from "@/components/landing/AssetMarquee";
import FaqAccordion from "@/components/landing/FaqAccordion";

/**
 * Marketing landing page.
 *
 * This route previously held a login/signup form with hardcoded statistics and
 * alert()-based validation, duplicating the dedicated /login and /signup pages.
 * The auth flows live there; this page only routes people towards them.
 *
 * Motion is confined to this file, the hero scene and the marquee. Everything
 * behind the auth wall stays static.
 *
 * Note on claims: there is no "trusted by N users" or "$N tracked" band here.
 * Those numbers would have to be invented, and a product whose entire pitch is
 * that its figures trace back to real trades cannot open with a fabricated one.
 * The capability strip below states things that are true of the build instead.
 */

const CAPABILITIES = [
  { value: "Non-custodial", label: "Withdrawal-capable keys refused" },
  { value: "Real-time", label: "Exchange WebSocket into TimescaleDB" },
  { value: "90 days", label: "Daily returns behind the optimizer" },
  { value: "No card", label: "Demo opens without signup" },
];

const FEATURES = [
  {
    icon: PieChart,
    title: "Your portfolio, computed",
    body: "Connect Binance or add holdings by hand. Cost basis, realised and unrealised P&L and allocation are derived from your actual trades — never estimated.",
    points: ["FIFO cost basis", "Per-asset P&L", "Live allocation"],
    wide: true,
  },
  {
    icon: LineChart,
    title: "Prices that are actually live",
    body: "A Binance WebSocket feed streams through Redis into a TimescaleDB hypertable, so your history is real market data rather than a polled snapshot.",
    points: [],
    wide: false,
  },
  {
    icon: Brain,
    title: "Ask about what you hold",
    body: "The advisor answers from your holdings, trades and risk metrics, retrieved at question time — so it cannot invent a position you do not own.",
    points: [],
    wide: false,
  },
  {
    icon: ShieldCheck,
    title: "Isolated by construction",
    body: "Every database query filters on the authenticated user id, so another account's rows are unreachable rather than merely hidden from the interface.",
    points: [],
    wide: true,
  },
];

const DIFFERENTIATORS = [
  {
    icon: BarChart3,
    label: "Optimiser",
    title: "Modern Portfolio Theory, on your holdings",
    body: "Maximum-Sharpe weights solved from 90 days of real daily returns, shown beside your current allocation — the gap between the two is the finding.",
  },
  {
    icon: Repeat,
    label: "Backtest",
    title: "Test a DCA plan before committing",
    body: "Simulate daily, weekly, biweekly or monthly contributions against real history, and against a lump-sum baseline that is reported even when it wins.",
  },
  {
    icon: Lock,
    label: "Custody",
    title: "Read-only keys, encrypted at rest",
    body: "API keys are encrypted with Fernet before storage, and any key carrying withdrawal permission is refused outright at connection time.",
  },
];

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

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`mx-auto w-full max-w-6xl px-6 py-20 md:py-28 ${className}`}>
      {children}
    </section>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Read once, at the top level. A reveal helper that called this itself could
  // not be used inside .map() without breaking the rules of hooks.
  const reduced = useReducedMotion();

  /** Scroll-reveal props, or nothing at all when reduced motion is requested —
   *  in which case the content is simply present rather than fading in. */
  const reveal = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" },
          transition: { duration: 0.5, delay, ease: "easeOut" as const },
        };

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
    <div className="bg-background text-foreground min-h-screen">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="bg-background/70 border-border sticky top-0 z-50 border-b backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="font-heading text-lg font-bold tracking-tight">VaultX</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <HeroVisual />

        {/* Radial wash behind the headline, so the 3D scene reads as depth
            rather than as an object sitting on a flat panel.

            Inline style, not an arbitrary Tailwind value: the slash in
            hsl(var(--primary)/0.14) is parsed as an opacity modifier, so the
            utility is dropped and the glow silently never renders. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem]"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.16), transparent 70%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-12 md:pt-28">
          <motion.div {...reveal()} className="flex flex-col items-center text-center">
            <Badge variant="outline" className="mb-6">
              <Sparkles className="mr-1.5 h-3 w-3" />
              Portfolio analytics, not just tracking
            </Badge>

            <h1 className="font-heading mx-auto max-w-4xl text-5xl leading-[1.05] font-bold tracking-tighter text-balance md:text-7xl">
              Know what your crypto is{" "}
              <span className="from-primary via-vaultx-secondary to-vaultx-accent bg-gradient-to-r bg-clip-text text-transparent">
                actually doing
              </span>
            </h1>

            <p className="text-muted-foreground mx-auto mt-7 max-w-xl text-lg text-pretty md:text-xl">
              Most trackers stop at totals. VaultX computes cost basis from your real trades,
              optimises your allocation, backtests strategies, and answers questions about the
              portfolio you actually hold.
            </p>

            <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                onClick={startDemo}
                loading={demoLoading}
                className="w-full sm:w-auto"
              >
                {demoLoading ? "Opening demo…" : "Explore the live demo"}
              </Button>
            </div>

            <p className="text-muted-foreground mt-4 text-xs">
              The demo is read-only. No signup, no card, no exchange keys.
            </p>
            {demoError && (
              <p className="text-vaultx-danger mt-3 text-sm" role="alert">
                {demoError}
              </p>
            )}
          </motion.div>

          {/* Framed product surface -- the centrepiece. */}
          <motion.div {...reveal(0.12)} className="mt-16 md:mt-20">
            <ProductPreview />
          </motion.div>
        </div>
      </div>

      {/* ── Asset strip ─────────────────────────────────────────────────── */}
      <div className="border-border border-y py-6">
        <p className="text-muted-foreground mb-5 text-center text-xs font-medium tracking-wider uppercase">
          Tracking major assets across Binance
        </p>
        <AssetMarquee />
      </div>

      {/* ── Capability strip ────────────────────────────────────────────── */}
      <Section className="!py-14">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {CAPABILITIES.map((item, i) => (
            <motion.div key={item.value} {...reveal(i * 0.06)} className="text-center">
              <div className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                {item.value}
              </div>
              <div className="text-muted-foreground mt-1.5 text-xs leading-relaxed text-balance">
                {item.label}
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Features (bento) ────────────────────────────────────────────── */}
      <Section className="!pt-6">
        <motion.h2
          {...reveal()}
          className="font-heading mb-4 text-center text-3xl font-bold tracking-tighter text-balance md:text-5xl"
        >
          Built on your real data
        </motion.h2>
        <motion.p
          {...reveal(0.05)}
          className="text-muted-foreground mx-auto mb-14 max-w-2xl text-center text-lg text-pretty"
        >
          Every figure traces back to a trade you made or a price that was recorded.
        </motion.p>

        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              {...reveal(i * 0.07)}
              className={feature.wide ? "md:col-span-2" : ""}
            >
              <Card interactive className="h-full p-7">
                <div className="bg-accent text-accent-foreground mb-5 flex h-11 w-11 items-center justify-center rounded-lg">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading mb-2.5 text-xl font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.body}</p>
                {feature.points.length > 0 && (
                  <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                    {feature.points.map(point => (
                      <li
                        key={point}
                        className="text-muted-foreground flex items-center gap-1.5 text-xs"
                      >
                        <Check className="text-vaultx-success h-3.5 w-3.5" />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Differentiators ─────────────────────────────────────────────── */}
      <div className="border-border bg-card/40 border-y">
        <Section>
          <motion.h2
            {...reveal()}
            className="font-heading mb-4 max-w-2xl text-3xl font-bold tracking-tighter text-balance md:text-5xl"
          >
            The analysis other trackers do not do
          </motion.h2>
          <motion.p
            {...reveal(0.05)}
            className="text-muted-foreground mb-14 max-w-2xl text-lg text-pretty"
          >
            Aggregators compete on how many wallets they can connect. None of them tell you
            whether your allocation is any good.
          </motion.p>

          <div className="grid gap-4 md:grid-cols-3">
            {DIFFERENTIATORS.map((item, i) => (
              <motion.div key={item.title} {...reveal(i * 0.07)}>
                <Card interactive className="h-full p-7">
                  <div className="mb-5 flex items-center gap-2">
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-md">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                      {item.label}
                    </span>
                  </div>
                  <h3 className="font-heading mb-2.5 text-lg font-semibold text-balance">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <Section>
        <motion.h2
          {...reveal()}
          className="font-heading mb-12 text-center text-3xl font-bold tracking-tighter md:text-5xl"
        >
          Questions
        </motion.h2>
        <motion.div {...reveal(0.05)}>
          <FaqAccordion items={FAQ} />
        </motion.div>
      </Section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <div className="border-border border-t">
        <Section className="relative overflow-hidden text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 50% 60% at 50% 100%, hsl(var(--primary) / 0.16), transparent 70%)",
            }}
          />
          <motion.div {...reveal()}>
            <h2 className="font-heading mx-auto max-w-2xl text-3xl font-bold tracking-tighter text-balance md:text-5xl">
              See it running before you sign up
            </h2>
            <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg text-pretty">
              The demo is a seeded account with real price history — the same analytics you would
              get on your own portfolio.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={startDemo} loading={demoLoading}>
                {demoLoading ? "Opening demo…" : "Explore the live demo"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Link href="/signup" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Create an account
                </Button>
              </Link>
            </div>
          </motion.div>
        </Section>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm sm:flex-row">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span>© {new Date().getFullYear()} VaultX</span>
          </div>
          <p className="text-xs">
            Analytics and backtests are historical, not predictions or financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
