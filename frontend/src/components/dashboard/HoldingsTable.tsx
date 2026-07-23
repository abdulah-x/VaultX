"use client";

import { MoreHorizontal, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableNumericCell,
 TableRow,
} from "@/components/ui/Table";
import { cn } from "@/lib/utils";

interface HoldingData {
 id: string;
 asset: string;
 symbol: string;
 qty: number;
 avgBuyPrice: number;
 lastPrice: number;
 marketValue: number;
 realizedPnL: number;
 unrealizedPnL: number;
 allocation: number;
 change24h: number;
 icon?: string;
}

interface HoldingsTableProps {
 holdings: HoldingData[];
 totalValue: number;
}

const formatCurrency = (value: number) =>
 new Intl.NumberFormat("en-US", {
 style: "currency",
 currency: "USD",
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 }).format(value);

const formatPercentage = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const formatNumber = (value: number, decimals = 4) =>
 value.toLocaleString("en-US", {
 minimumFractionDigits: decimals,
 maximumFractionDigits: decimals,
 });

const pnlTone = (positive: boolean) => (positive ? "text-vaultx-success" : "text-vaultx-danger");

/**
 * Entirely static.
 *
 * Rows previously staggered in and each allocation bar animated its width from
 * zero. Both re-ran whenever the holdings array changed -- which is every price
 * tick -- so the table was in continuous motion precisely while someone was
 * trying to read a number off it.
 */
export default function HoldingsTable({ holdings, totalValue }: HoldingsTableProps) {
 return (
 <Card className="overflow-hidden">
 <div className="border-border flex items-center justify-between border-b p-6">
 <h3 className="font-heading text-lg font-bold">Asset Holdings</h3>
 <button
 type="button"
 aria-label="Holdings options"
 className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-2 transition-colors active:scale-95"
 >
 <MoreHorizontal className="h-5 w-5" />
 </button>
 </div>

 <Table>
 <TableHeader>
 <TableRow className="hover:bg-transparent">
 <TableHead className="px-6">Asset</TableHead>
 <TableHead className="px-6 text-right">Qty</TableHead>
 <TableHead className="px-6 text-right">Avg Buy Price</TableHead>
 <TableHead className="px-6 text-right">Market Price</TableHead>
 <TableHead className="px-6 text-right">Market Value</TableHead>
 <TableHead className="px-6 text-right">Unrealized PnL</TableHead>
 <TableHead className="px-6 text-right">24h Change</TableHead>
 <TableHead className="px-6 text-right">Allocation</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {holdings.map((holding) => {
 const pnlPositive = holding.unrealizedPnL >= 0;
 const changePositive = holding.change24h >= 0;
 const costBasisPct =
 holding.avgBuyPrice === 0
 ? 0
 : ((holding.lastPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100;
 const portfolioPct = totalValue === 0 ? 0 : (holding.marketValue / totalValue) * 100;

 return (
 <TableRow key={holding.id} className="cursor-pointer">
 <TableCell className="px-6 whitespace-nowrap">
 <div className="flex items-center gap-3">
 <div className="bg-secondary text-secondary-foreground flex h-8 w-8 items-center justify-center rounded-full">
 <span className="text-xs font-bold">{holding.symbol.slice(0, 1)}</span>
 </div>
 <div>
 <div className="text-sm font-medium">{holding.asset}</div>
 <div className="text-muted-foreground text-xs">{holding.symbol}</div>
 </div>
 </div>
 </TableCell>

 <TableNumericCell className="px-6 text-right text-sm font-medium">
 {formatNumber(holding.qty)}
 </TableNumericCell>

 <TableNumericCell className="px-6 text-right text-sm font-medium">
 {formatCurrency(holding.avgBuyPrice)}
 </TableNumericCell>

 <TableNumericCell className="px-6 text-right text-sm font-medium">
 {formatCurrency(holding.lastPrice)}
 </TableNumericCell>

 <TableNumericCell className="px-6 text-right">
 <div className="text-sm font-medium">{formatCurrency(holding.marketValue)}</div>
 <div className="text-muted-foreground font-sans text-xs">
 {portfolioPct.toFixed(1)}% of portfolio
 </div>
 </TableNumericCell>

 <TableNumericCell className="px-6 text-right">
 <div
 className={cn(
 "flex items-center justify-end gap-1 text-sm font-medium",
 pnlTone(pnlPositive),
 )}
 >
 {pnlPositive ? (
 <ArrowUpRight className="h-3 w-3" />
 ) : (
 <ArrowDownRight className="h-3 w-3" />
 )}
 {formatCurrency(Math.abs(holding.unrealizedPnL))}
 </div>
 <div className={cn("text-xs", pnlTone(pnlPositive))}>
 {formatPercentage(costBasisPct)}
 </div>
 </TableNumericCell>

 <TableNumericCell className="px-6 text-right">
 <div
 className={cn(
 "flex items-center justify-end gap-1 text-sm font-medium",
 pnlTone(changePositive),
 )}
 >
 {changePositive ? (
 <TrendingUp className="h-3 w-3" />
 ) : (
 <TrendingDown className="h-3 w-3" />
 )}
 {formatPercentage(holding.change24h)}
 </div>
 </TableNumericCell>

 <TableNumericCell className="px-6 text-right">
 <div className="bg-muted ml-auto h-2 w-16 overflow-hidden rounded-full">
 <div
 className="bg-primary h-2 rounded-full"
 style={{ width: `${Math.min(100, Math.max(0, holding.allocation))}%` }}
 />
 </div>
 <div className="text-muted-foreground mt-1 text-xs">
 {holding.allocation.toFixed(1)}%
 </div>
 </TableNumericCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </Card>
 );
}
