/**
 * Shapes returned by the portfolio/P&L endpoints, plus the single normalized
 * row the UI components consume.
 *
 * Money fields on the portfolio endpoints arrive as DECIMAL strings; the raw
 * interfaces below say `string` so that a caller reaching for `.toFixed()` on
 * one fails at compile time rather than at render time, which is exactly how
 * the dashboard used to break.
 */

import { toNum } from "@/lib/format";

/** A holding exactly as the API sends it. */
export interface ApiHolding {
  asset_symbol: string;
  asset_name: string;
  total_quantity: string;
  available_quantity?: string;
  locked_quantity?: string;
  average_cost_usd: string;
  current_price_usd: string;
  current_value_usd: string;
  unrealized_pnl_usd: string;
  unrealized_pnl_percentage: string;
  portfolio_percentage?: string;
}

export interface ApiPortfolioSummary {
  total_portfolio_value_usd: string;
  total_cost_usd: string;
  total_unrealized_pnl_usd: string;
  total_unrealized_pnl_percentage: string;
  asset_count: number;
  last_updated?: string;
  holdings: ApiHolding[];
}

export interface PortfolioResponse {
  success: boolean;
  user_id?: number;
  timestamp?: string;
  portfolio_summary: ApiPortfolioSummary;
}

/** The normalized, fully-numeric row every table/chart component takes. */
export interface HoldingRow {
  id: string;
  asset: string;
  symbol: string;
  qty: number;
  avgBuyPrice: number;
  lastPrice: number;
  marketValue: number;
  costBasis: number;
  realizedPnL: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocation: number;
}

/** Totals derived once, so no component re-parses the decimal strings. */
export interface PortfolioTotals {
  totalValue: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  assetCount: number;
}

export function normalizeHolding(holding: ApiHolding, index: number): HoldingRow {
  const marketValue = toNum(holding.current_value_usd);
  const quantity = toNum(holding.total_quantity);
  const avgBuyPrice = toNum(holding.average_cost_usd);

  return {
    id: `${holding.asset_symbol}-${index}`,
    asset: holding.asset_name || holding.asset_symbol,
    symbol: holding.asset_symbol,
    qty: quantity,
    avgBuyPrice,
    lastPrice: toNum(holding.current_price_usd),
    marketValue,
    costBasis: quantity * avgBuyPrice,
    // Realized P&L is per-trade, not per-holding: it lives on the trades/P&L
    // endpoints, so it is not knowable from a holdings row.
    realizedPnL: 0,
    unrealizedPnL: toNum(holding.unrealized_pnl_usd),
    unrealizedPnLPercent: toNum(holding.unrealized_pnl_percentage),
    allocation: toNum(holding.portfolio_percentage),
  };
}

export function normalizeTotals(summary?: ApiPortfolioSummary): PortfolioTotals {
  return {
    totalValue: toNum(summary?.total_portfolio_value_usd),
    totalCost: toNum(summary?.total_cost_usd),
    unrealizedPnL: toNum(summary?.total_unrealized_pnl_usd),
    unrealizedPnLPercent: toNum(summary?.total_unrealized_pnl_percentage),
    assetCount: toNum(summary?.asset_count),
  };
}

/** Brand colours, so allocation charts agree across pages. */
export const ASSET_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  BNB: "#f3ba2f",
  SOL: "#00d4aa",
  ADA: "#0033ad",
  DOT: "#e6007a",
  MATIC: "#8247e5",
  AVAX: "#e84142",
  LINK: "#2a5ada",
  UNI: "#ff007a",
};

export const FALLBACK_ASSET_COLOR = "#8b5cf6";

export function assetColor(symbol: string): string {
  return ASSET_COLORS[symbol] || FALLBACK_ASSET_COLOR;
}
