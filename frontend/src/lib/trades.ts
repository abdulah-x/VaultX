/**
 * Derived trade statistics.
 *
 * Win rate, best trade and worst trade have no dedicated API field, so the
 * analytics page previously displayed invented constants (78.5%, 247 trades,
 * a $45,200 best trade) for every user. They are all computable from the real
 * trade list: a trade counts as closed once the backend has attached a
 * `realized_pnl_usd` to it, which only happens on the sell side.
 */

import { toNum } from "@/lib/format";

export interface ApiTrade {
  id: number;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  side: string;
  order_type: string;
  quantity: number;
  price: number;
  quote_quantity: number;
  commission: number;
  commission_asset: string;
  executed_at: string;
  realized_pnl_usd: number | null;
  realized_pnl_percentage: number | null;
}

export interface TradeAggregates {
  totalTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  /** Null when nothing has been closed -- a 0% win rate would be a lie. */
  winRate: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  totalRealized: number;
  totalVolume: number;
  averageTradeSize: number;
}

export function extractTrades(tradesResponse: unknown): ApiTrade[] {
  const trades = (tradesResponse as any)?.data?.trades;
  return Array.isArray(trades) ? trades : [];
}

export function extractPagination(tradesResponse: unknown) {
  const pagination = (tradesResponse as any)?.data?.pagination ?? {};
  return {
    totalCount: toNum(pagination.total_count),
    page: toNum(pagination.page, 1),
    pageSize: toNum(pagination.page_size, 25),
    totalPages: toNum(pagination.total_pages, 1),
    hasNext: !!pagination.has_next,
    hasPrevious: !!pagination.has_previous,
  };
}

export function aggregateTrades(trades: ApiTrade[]): TradeAggregates {
  // A trade with no realized P&L is an open position, not a break-even one.
  const closed = trades.filter(
    trade => trade.realized_pnl_usd !== null && trade.realized_pnl_usd !== undefined
  );
  const pnls = closed.map(trade => toNum(trade.realized_pnl_usd));

  const winningTrades = pnls.filter(pnl => pnl > 0).length;
  const losingTrades = pnls.filter(pnl => pnl < 0).length;

  const volume = trades.reduce((sum, trade) => sum + Math.abs(toNum(trade.quote_quantity)), 0);

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    winningTrades,
    losingTrades,
    winRate: closed.length > 0 ? (winningTrades / closed.length) * 100 : null,
    bestTrade: pnls.length > 0 ? Math.max(...pnls) : null,
    worstTrade: pnls.length > 0 ? Math.min(...pnls) : null,
    totalRealized: pnls.reduce((sum, pnl) => sum + pnl, 0),
    totalVolume: volume,
    averageTradeSize: trades.length > 0 ? volume / trades.length : 0,
  };
}

/** Per-asset P&L rows from /api/pnl/comprehensive, already numeric. */
export interface AssetPnl {
  symbol: string;
  pnl_usd: number;
  pnl_percentage: number;
  current_value: number;
  invested_value: number;
}

export function extractAssetPnl(comprehensiveResponse: unknown): AssetPnl[] {
  const assets = (comprehensiveResponse as any)?.detailed_pnl?.portfolio_based?.assets;
  if (!Array.isArray(assets)) return [];
  return assets.map((asset: any) => ({
    symbol: String(asset.asset ?? ""),
    pnl_usd: toNum(asset.pnl),
    pnl_percentage: toNum(asset.pnl_percentage),
    current_value: toNum(asset.current_value),
    invested_value: toNum(asset.invested_value),
  }));
}
