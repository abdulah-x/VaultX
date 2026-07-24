/**
 * React Query hooks over lib/api.
 *
 * React Query was installed and its provider mounted from the beginning, but
 * had zero call sites -- every page hand-rolled useEffect + axios along with
 * its own loading, error and mock-fallback branches. That duplication is what
 * let each page drift into reading a different (and mostly wrong) shape of the
 * same response.
 *
 * Every hook here gates on an authenticated session. Firing before the token
 * exists produces a 401, and the axios response interceptor turns a 401 into a
 * redirect to /login -- so an ungated query would bounce a legitimately
 * signed-in user off the page during the first render.
 */

import { useQuery, useMutation, UseQueryOptions } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/lib/api";
import {
  PortfolioResponse,
  HoldingRow,
  PortfolioTotals,
  normalizeHolding,
  normalizeTotals,
} from "@/types/portfolio";

export const queryKeys = {
  portfolio: ["portfolio"] as const,
  portfolioKpis: ["portfolio", "kpis"] as const,
  portfolioOptimize: (days?: number) => ["portfolio", "optimize", days ?? 90] as const,
  pnlComprehensive: ["pnl", "comprehensive"] as const,
  pnlPerformance: ["pnl", "performance"] as const,
  trades: (params?: unknown) => ["trades", params ?? {}] as const,
  tradeStats: ["trades", "stats"] as const,
  prices: (symbols: string[]) => ["prices", ...symbols] as const,
  dcaPresets: (contribution?: number) => ["strategy", "dca-presets", contribution ?? 100] as const,
};

/** Shared config for anything derived from the user's own portfolio. */
type Options<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;

function useSession() {
  const { user, isLoading } = useAuth();
  return { user, ready: !!user && !isLoading };
}

// ── Portfolio ───────────────────────────────────────────────────────────────

export interface PortfolioData {
  totals: PortfolioTotals;
  holdings: HoldingRow[];
}

/**
 * The canonical portfolio read. Selects down to fully-numeric holdings and
 * totals so no component ever touches a raw DECIMAL string.
 */
export function usePortfolio(options?: Options<PortfolioData>) {
  const { ready } = useSession();

  return useQuery<PortfolioData, Error>({
    queryKey: queryKeys.portfolio,
    queryFn: async (): Promise<PortfolioData> => {
      const response: PortfolioResponse = await api.portfolio.summary();
      const summary = response?.portfolio_summary;
      return {
        totals: normalizeTotals(summary),
        holdings: (summary?.holdings ?? []).map(normalizeHolding),
      };
    },
    enabled: ready,
    ...options,
  });
}

/**
 * Capital-gain breakdown (realized / unrealized / today) plus an IRR growth
 * rate. /portfolio/summary carries none of these, which is why the dashboard
 * previously hardcoded "Realized P&L: $0".
 */
export function usePortfolioKpis(options?: Options<any>) {
  const { ready } = useSession();

  return useQuery<any, Error>({
    queryKey: queryKeys.portfolioKpis,
    queryFn: () => api.portfolio.kpis(),
    enabled: ready,
    ...options,
  });
}

/** MPT optimizer: current vs Sharpe-optimal weights. */
export function usePortfolioOptimize(lookbackDays?: number, options?: Options<any>) {
  const { ready } = useSession();

  return useQuery<any, Error>({
    queryKey: queryKeys.portfolioOptimize(lookbackDays),
    queryFn: () => api.portfolio.optimize(lookbackDays),
    enabled: ready,
    // The optimizer runs a covariance matrix over 90 days of price history;
    // it does not change minute to minute.
    staleTime: 10 * 60 * 1000,
    ...options,
  });
}

// ── P&L ─────────────────────────────────────────────────────────────────────

/** Numeric (float) P&L totals, realized split, and per-asset breakdown. */
export function usePnlComprehensive(options?: Options<any>) {
  const { ready } = useSession();

  return useQuery<any, Error>({
    queryKey: queryKeys.pnlComprehensive,
    queryFn: () => api.pnl.comprehensive(),
    enabled: ready,
    ...options,
  });
}

/** Real daily/cumulative P&L time series -- replaces the Math.random() charts. */
export function usePnlPerformance(options?: Options<any>) {
  const { ready } = useSession();

  return useQuery<any, Error>({
    queryKey: queryKeys.pnlPerformance,
    queryFn: () => api.pnl.performance(),
    enabled: ready,
    ...options,
  });
}

// ── Trades ──────────────────────────────────────────────────────────────────

export interface TradeParams {
  page?: number;
  page_size?: number;
  symbol?: string;
  side?: string;
  start_date?: string;
  end_date?: string;
}

export function useTrades(params?: TradeParams, options?: Options<any>) {
  const { ready } = useSession();

  return useQuery<any, Error>({
    queryKey: queryKeys.trades(params),
    queryFn: () => api.trades.list(params),
    enabled: ready,
    ...options,
  });
}

export function useTradeStats(options?: Options<any>) {
  const { ready } = useSession();

  return useQuery<any, Error>({
    queryKey: queryKeys.tradeStats,
    queryFn: () => api.trades.stats(),
    enabled: ready,
    ...options,
  });
}

// ── Prices ──────────────────────────────────────────────────────────────────

export interface LivePrice {
  symbol: string;
  price: number;
  timestamp: string;
}

/**
 * Live prices, polled. The backend does expose a /prices/stream WebSocket, but
 * nothing on the client speaks it yet; polling keeps this honest rather than
 * showing a "LIVE" badge over a one-shot fetch, which is what happened before.
 */
export function useLivePrices(symbols: string[], intervalMs = 15_000) {
  const { ready } = useSession();

  return useQuery<Record<string, LivePrice>, Error>({
    queryKey: queryKeys.prices(symbols),
    queryFn: async () => {
      const response = await api.prices.getCurrent(symbols);
      return (response?.prices ?? {}) as Record<string, LivePrice>;
    },
    enabled: ready && symbols.length > 0,
    refetchInterval: intervalMs,
    // Prices are the one thing that should keep up with a refocused tab.
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export interface MarketTicker {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  quoteVolume: number;
  high: number;
  low: number;
}

/**
 * 24h tickers for a set of trading pairs.
 *
 * One request per symbol, because that is what the API offers. Polled at 30s
 * rather than the price feed's 15s: this path reaches Binance's REST API,
 * whereas /prices/current is served from the local price table.
 */
export function useMarketTickers(symbols: string[], intervalMs = 30_000) {
  const { ready } = useSession();

  return useQuery<MarketTicker[], Error>({
    queryKey: ["market", "tickers", ...symbols],
    queryFn: async () => {
      const results = await Promise.allSettled(symbols.map(s => api.prices.getTicker(s)));
      return results
        .map((result, index) => {
          if (result.status !== "fulfilled" || !result.value?.success) return null;
          const data = result.value;
          return {
            symbol: symbols[index],
            price: Number(data.last_price),
            change: Number(data.price_change),
            changePercent: Number(data.price_change_percent),
            quoteVolume: Number(data.quote_volume),
            high: Number(data.high_price),
            low: Number(data.low_price),
          };
        })
        .filter((t): t is MarketTicker => t !== null && Number.isFinite(t.price));
    },
    enabled: ready && symbols.length > 0,
    refetchInterval: intervalMs,
    refetchOnWindowFocus: true,
  });
}

// ── Strategy ────────────────────────────────────────────────────────────────

export function useDcaPresets(contribution?: number, options?: Options<any>) {
  const { ready } = useSession();

  return useQuery<any, Error>({
    queryKey: queryKeys.dcaPresets(contribution),
    queryFn: () => api.strategy.dcaPresets(contribution ? { contribution } : undefined),
    enabled: ready,
    staleTime: 10 * 60 * 1000,
    ...options,
  });
}

// ── Advisor ─────────────────────────────────────────────────────────────────

export interface AdvisorResponse {
  answer: string;
  referenced_symbols?: string[];
  disclaimer?: string;
}

/**
 * A mutation, not a query: each question is a distinct action with a cost, and
 * must never be retried or replayed from cache.
 */
export function useAdvisorChat() {
  return useMutation<AdvisorResponse, Error, string>({
    mutationFn: (question: string) => api.advisor.chat(question),
    retry: false,
  });
}
