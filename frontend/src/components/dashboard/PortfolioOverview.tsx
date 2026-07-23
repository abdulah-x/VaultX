"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface PortfolioAllocation {
 asset: string;
 value: number;
 percentage: number;
 color: string;
 [key: string]: string | number;
}

interface PortfolioOverviewProps {
 totalBalance: string;
 allocationData: PortfolioAllocation[];
 dayChange: {
 value: string;
 percentage: string;
 isPositive: boolean;
 };
 weekChange: {
 value: string;
 percentage: string;
 isPositive: boolean;
 };
}

/** Recharts renders into SVG, which cannot read Tailwind classes -- these have
 * to be real colour values, so they read the same CSS variables the utilities
 * are built from and therefore still follow the theme. */
const CHART_TEXT = "hsl(var(--foreground))";
const CHART_STROKE = "hsl(var(--card))";

const tone = (positive: boolean) => (positive ? "text-vaultx-success" : "text-vaultx-danger");

function ChangeTile({
 label,
 change,
}: {
 label: string;
 change: { value: string; percentage: string; isPositive: boolean };
}) {
 return (
 <div className="border-border bg-secondary/40 rounded-lg border p-4 text-center">
 <div className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">{label}</div>
 <div className={cn("font-mono text-lg font-bold tabular-nums", tone(change.isPositive))}>
 {change.value}
 </div>
 <div className={cn("font-mono text-sm tabular-nums", tone(change.isPositive))}>
 {change.percentage}
 </div>
 </div>
 );
}

export default function PortfolioOverview({
 totalBalance,
 allocationData,
 dayChange,
 weekChange,
}: PortfolioOverviewProps) {
 const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

 // Group small allocations into "Others" (anything below 5%)
 const processedAllocationData = (() => {
 const threshold = 5;
 const mainAssets = allocationData.filter((item) => item.percentage >= threshold);
 const smallAssets = allocationData.filter((item) => item.percentage < threshold);

 if (smallAssets.length > 0) {
 return [
 ...mainAssets,
 {
 asset: "Others",
 value: smallAssets.reduce((sum, item) => sum + item.value, 0),
 percentage: smallAssets.reduce((sum, item) => sum + item.percentage, 0),
 color: "var(--color-vaultx-secondary)",
 },
 ];
 }

 return mainAssets;
 })();

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const renderCustomLabel = (entry: any) => {
 const { cx, cy, midAngle, innerRadius, outerRadius, percent, asset } = entry;
 const RADIAN = Math.PI / 180;
 const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
 const x = cx + radius * Math.cos(-midAngle * RADIAN);
 const y = cy + radius * Math.sin(-midAngle * RADIAN);

 // Only show labels for slices > 8% to avoid clutter
 if (percent < 0.08) return null;

 return (
 <text
 x={x}
 y={y}
 fill={CHART_TEXT}
 textAnchor={x > cx ? "start" : "end"}
 dominantBaseline="central"
 style={{ fontSize: "12px", fontWeight: 600 }}
 >
 {`${asset}`}
 </text>
 );
 };

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const CustomTooltip = ({ active, payload }: any) => {
 if (active && payload && payload.length) {
 const data = payload[0].payload;
 return (
 <div className="bg-popover text-popover-foreground border-border rounded-lg border p-4 shadow-lg">
 <div className="mb-2 text-xl font-bold">{data.asset}</div>
 <div className="flex items-center justify-between gap-4">
 <span className="text-muted-foreground font-mono text-lg font-semibold tabular-nums">
 {data.percentage.toFixed(1)}%
 </span>
 <span className="font-mono text-lg font-bold tabular-nums">
 ${data.value.toLocaleString()}
 </span>
 </div>
 </div>
 );
 }
 return null;
 };

 return (
 <Card className="p-6">
 <div className="mb-6 flex items-center justify-center">
 <h3 className="font-heading text-lg font-bold">Portfolio Overview</h3>
 </div>

 <div className="flex w-full flex-col items-center">
 {/* Donut chart */}
 <div className="relative mb-6 flex w-full max-w-md justify-center" style={{ height: 320 }}>
 <ResponsiveContainer width="100%" height={320}>
 <PieChart>
 <Pie
 data={processedAllocationData}
 cx="50%"
 cy="50%"
 labelLine={false}
 label={renderCustomLabel}
 outerRadius={120}
 innerRadius={80}
 startAngle={90}
 endAngle={450}
 paddingAngle={3}
 dataKey="value"
 stroke={CHART_STROKE}
 strokeWidth={3}
 isAnimationActive={false}
 onMouseEnter={(data) => setHoveredSlice(data.asset)}
 onMouseLeave={() => setHoveredSlice(null)}
 style={{ cursor: "pointer" }}
 >
 {processedAllocationData.map((entry, index) => (
 <Cell
 key={`cell-${index}`}
 fill={entry.color}
 fillOpacity={hoveredSlice === null || hoveredSlice === entry.asset ? 1 : 0.6}
 style={{ transition: "fill-opacity 0.2s ease" }}
 />
 ))}
 </Pie>
 <Tooltip content={<CustomTooltip />} />
 </PieChart>
 </ResponsiveContainer>

 {/* Center label */}
 <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
 <div className="text-center">
 <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
 Total Balance
 </div>
 <div className="font-mono text-4xl font-bold tracking-tight tabular-nums">
 {totalBalance}
 </div>
 </div>
 </div>
 </div>

 {/* Performance summary */}
 <div className="w-full max-w-md">
 <div className="mb-6 grid grid-cols-2 gap-4">
 <ChangeTile label="24h Change" change={dayChange} />
 <ChangeTile label="7d Change" change={weekChange} />
 </div>

 <div className="flex gap-3">
 <Button variant="outline" size="lg" className="flex-1">
 View Details
 </Button>
 <Button size="lg" className="flex-1">
 Rebalance
 </Button>
 </div>
 </div>
 </div>
 </Card>
 );
}
