"use client";

import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Skeleton from "@/components/ui/Skeleton";
import { useTrades } from "@/hooks/queries";
import { extractTrades, extractPagination, aggregateTrades } from "@/lib/trades";
import { usd, signedUsd, compactUsd, qty as fmtQty } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";

const SIDE_FILTER = ["ALL", "BUY", "SELL"] as const;
type SideFilter = (typeof SIDE_FILTER)[number];

const PAGE_SIZE = 20;

export default function TradesPage() {
  const [page, setPage] = useState(1);
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");
  const [search, setSearch] = useState("");

  // Side is filtered server-side (the API supports it) so the counts and
  // pagination stay consistent; the previous version filtered the current page
  // in the browser, which made "page 2 of 3" show a handful of rows.
  const query = useTrades({
    page,
    page_size: PAGE_SIZE,
    ...(sideFilter !== "ALL" ? { side: sideFilter } : {}),
  });

  const trades = extractTrades(query.data);
  const pagination = extractPagination(query.data);
  const aggregates = aggregateTrades(trades);

  // Symbol search stays client-side: it's a substring match over the loaded
  // page, and the API expects a full trading pair rather than a fragment.
  const filtered = trades.filter(
    trade =>
      !search ||
      trade.symbol?.toLowerCase().includes(search.toLowerCase()) ||
      trade.base_asset?.toLowerCase().includes(search.toLowerCase())
  );

  const buys = trades.filter(t => t.side?.toUpperCase() === "BUY").length;
  const sells = trades.filter(t => t.side?.toUpperCase() === "SELL").length;

  const stats = [
    {
      label: "Trades (page)",
      value: String(pagination.totalCount || trades.length),
      icon: Activity,
      color: "text-primary",
    },
    {
      label: "Volume (page)",
      value: compactUsd(trades.reduce((sum, t) => sum + Math.abs(t.quote_quantity ?? 0), 0)),
      icon: ArrowUpDown,
      color: "text-vaultx-secondary",
    },
    {
      label: "Realized P&L (page)",
      value: signedUsd(aggregates.totalRealized),
      icon: aggregates.totalRealized >= 0 ? TrendingUp : TrendingDown,
      color: aggregates.totalRealized >= 0 ? "text-vaultx-success" : "text-vaultx-danger",
    },
    {
      label: "Buy / Sell",
      value: `${buys} / ${sells}`,
      icon: Activity,
      color: "text-primary",
    },
  ];

  const changeSide = (next: SideFilter) => {
    setSideFilter(next);
    // Staying on page 4 of an unfiltered list while switching to a filter that
    // has one page leaves the table empty.
    setPage(1);
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div>
            <h1 className="text-foreground text-3xl font-bold">Trade History</h1>
            <p className="text-muted-foreground mt-1">Complete history of your trading activity</p>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card border-border rounded-xl border p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-muted-foreground text-xs font-medium">{label}</span>
                </div>
                <p className={`font-mono text-lg font-bold tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="bg-secondary flex gap-1 rounded-lg p-1">
              {SIDE_FILTER.map(f => (
                <button
                  key={f}
                  onClick={() => changeSide(f)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                    sideFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative max-w-xs flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border py-2 pr-4 pl-10 text-sm transition-colors focus:outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border-border overflow-hidden rounded-2xl border">
            {query.isLoading ? (
              <div className="space-y-2 p-6">
                {[0, 1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : query.isError ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <AlertCircle className="text-vaultx-danger h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  {query.error?.message || "Couldn't load your trades."}
                </p>
                <button
                  onClick={() => query.refetch()}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-border bg-secondary border-b">
                      {["Date", "Pair", "Side", "Qty", "Price", "Total", "P&L", "Fee"].map(h => (
                        <th
                          key={h}
                          className={`text-muted-foreground px-5 py-4 text-xs font-semibold tracking-wider uppercase ${
                            h === "Date" || h === "Pair" || h === "Side"
                              ? "text-left"
                              : "text-right"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {filtered.map(trade => {
                      const isBuy = trade.side?.toUpperCase() === "BUY";
                      const pnl = trade.realized_pnl_usd;
                      const pair =
                        trade.base_asset && trade.quote_asset
                          ? `${trade.base_asset}/${trade.quote_asset}`
                          : trade.symbol;
                      return (
                        <tr key={trade.id} className="hover:bg-secondary/60 transition-colors">
                          <td className="text-muted-foreground px-5 py-4 text-sm whitespace-nowrap">
                            {new Date(trade.executed_at).toLocaleDateString()}{" "}
                            <span className="text-muted-foreground text-xs">
                              {new Date(trade.executed_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                          <td className="text-foreground px-5 py-4 font-semibold">{pair}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                isBuy
                                  ? "bg-vaultx-success/20 text-vaultx-success"
                                  : "bg-vaultx-danger/20 text-vaultx-danger"
                              }`}
                            >
                              {trade.side?.toUpperCase()}
                            </span>
                          </td>
                          <td className="text-foreground px-5 py-4 text-right font-mono text-sm tabular-nums">
                            {fmtQty(trade.quantity)}
                          </td>
                          <td className="text-foreground px-5 py-4 text-right font-mono text-sm tabular-nums">
                            {usd(trade.price)}
                          </td>
                          <td className="text-foreground px-5 py-4 text-right font-mono text-sm tabular-nums">
                            {/*
                              quote_quantity is the executed notional as the
                              exchange reported it. Recomputing qty * price
                              silently disagrees with it on partial fills.
                            */}
                            {usd(trade.quote_quantity ?? trade.quantity * trade.price)}
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-sm font-semibold tabular-nums">
                            {pnl !== null && pnl !== undefined ? (
                              <span
                                className={
                                  pnl >= 0 ? "text-vaultx-success" : "text-vaultx-danger"
                                }
                              >
                                {signedUsd(pnl)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="text-muted-foreground px-5 py-4 text-right font-mono text-xs tabular-nums">
                            {trade.commission !== undefined && trade.commission !== null
                              ? `${fmtQty(trade.commission)} ${trade.commission_asset ?? ""}`.trim()
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-muted-foreground px-6 py-16 text-center text-sm"
                        >
                          {search
                            ? `No trades matching "${search}"`
                            : sideFilter !== "ALL"
                              ? `No ${sideFilter} trades yet`
                              : "No trades yet. Import your history to see it here."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="border-border flex flex-col items-center justify-between gap-4 border-t px-6 py-4 sm:flex-row">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevious}
                  className="bg-secondary text-foreground hover:bg-accent flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="text-muted-foreground text-sm">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount}{" "}
                  trades
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!pagination.hasNext}
                  className="bg-secondary text-foreground hover:bg-accent flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
