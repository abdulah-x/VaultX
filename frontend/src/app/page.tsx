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
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ThemeToggle from "@/components/ui/ThemeToggle";
import HeroVisual from "@/components/landing/HeroVisual";

/**
 * Marketing landing page.
 *
 * This route previously held a login/signup form with hardcoded statistics and
 * alert()-based validation, duplicating the dedicated /login and /signup pages.
 * The auth flows live there; this page only routes people towards them.
 *
 * Motion is confined to this file and the hero scene. Everything behind the
 * auth wall stays static.
 */

const FEATURES = [
  {
    icon: PieChart,
    title: "Portfolio, in one view",
    body: "Connect Binance or add holdings by hand. Cost basis, realised and unrealised P&L, and allocation are computed from your actual trades — not estimated.",
  },
  {
    icon: LineChart,
    title: "Live prices, really live",
    body: "A Binance WebSocket feed streams into a TimescaleDB hypertable through Redis, so history is real market data rather than a polled snapshot.",
  },
  {
    icon: Brain,
    title: "Ask about your own portfolio",
    body: "The advisor answers from your holdings, trades and risk metrics — retrieved at question time, so it cannot invent a position you do not hold.",
  },
];

const DIFFERENTIATORS = [
  {
    icon: BarChart3,
    label: "Optimiser",
    title: "Modern Portfolio Theory, on your holdings",
    body: "Maximum-Sharpe weights solved from 90 days of real daily returns, shown beside your current allocation so the comparison is the point.",
  },
  {
    icon: Repeat,
    label: "Backtest",
    title: "Test a DCA plan before committing",
    body: "Simulate daily, weekly, biweekly or monthly contributions against real history — and against a lump-sum baseline, reported even when lump sum wins.",
  },
  {
    icon: ShieldCheck,
    label: "Custody",
    title: "Read-only keys, encrypted at rest",
    body: "API keys are encrypted with Fernet before storage, and a key with withdrawal permission is refused outright at connection time.",
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
      <header className="bg-background/80 border-border sticky top-0 z-50 border-b backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span className="font-heading text-lg font-bold">VaultX</span>
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
        <Section className="relative flex flex-col items-center text-center">
          <motion.div {...reveal()}>
            <Badge variant="outline" className="mb-6">
              <Sparkles className="mr-1.5 h-3 w-3" />
              Portfolio analytics, not just tracking
            </Badge>
            <h1 className="font-heading mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
              Know what your crypto is actually doing
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg text-pretty">
              Most trackers stop at totals. VaultX computes cost basis from your real trades,
              optimises your allocation, backtests strategies, and answers questions about the
              portfolio you actually hold.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
        </Section>
      </div>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <Section>
        <motion.h2
          {...reveal()}
          className="font-heading mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl"
        >
          Built on your real data
        </motion.h2>
        <motion.p
          {...reveal(0.05)}
          className="text-muted-foreground mx-auto mb-14 max-w-2xl text-center text-pretty"
        >
          Every figure traces back to a trade you made or a price that was recorded.
        </motion.p>

        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div key={feature.title} {...reveal(i * 0.08)}>
              <Card interactive className="h-full p-6">
                <div className="bg-accent text-accent-foreground mb-5 flex h-11 w-11 items-center justify-center rounded-md">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.body}</p>
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
            className="font-heading mb-14 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl"
          >
            The analysis other trackers do not do
          </motion.h2>

          <div className="grid gap-6 md:grid-cols-3">
            {DIFFERENTIATORS.map((item, i) => (
              <motion.div key={item.title} {...reveal(i * 0.08)}>
                <Card className="h-full p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <item.icon className="text-primary h-4 w-4" />
                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      {item.label}
                    </span>
                  </div>
                  <h3 className="font-heading mb-2 text-lg font-semibold text-balance">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Security ────────────────────────────────────────────────────── */}
      <Section>
        <motion.div {...reveal()}>
          <Card className="flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:p-10">
            <div className="bg-accent text-accent-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-md">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-heading mb-2 text-xl font-semibold">
                VaultX never takes custody of your funds
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Exchange keys are encrypted at rest, and any key carrying withdrawal permission is
                rejected when you connect it. Sessions are short-lived, revocable, and every
                database query is scoped to your account.
              </p>
            </div>
          </Card>
        </motion.div>
      </Section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <Section>
        <motion.h2
          {...reveal()}
          className="font-heading mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl"
        >
          Questions
        </motion.h2>
        <div className="mx-auto grid max-w-3xl gap-4">
          {FAQ.map((item, i) => (
            <motion.div key={item.q} {...reveal(i * 0.05)}>
              <Card className="p-6">
                <h3 className="mb-2 font-semibold">{item.q}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <div className="border-border bg-card/40 border-t">
        <Section className="text-center">
          <motion.div {...reveal()}>
            <h2 className="font-heading mx-auto max-w-2xl text-3xl font-bold tracking-tight text-balance md:text-4xl">
              See it running before you sign up
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-pretty">
              The demo is a seeded account with real price history — the same analytics you would
              get on your own portfolio.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={startDemo} loading={demoLoading}>
                {demoLoading ? "Opening demo…" : "Explore the live demo"}
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
