"use client";

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Treemap, ResponsiveContainer, Cell, Tooltip } from 'recharts';

interface HeatmapData {
 name: string;
 value: number;
 allocation: number;
 change24h: number;
 price: number;
 color: string;
 [key: string]: any; // Add index signature for Treemap compatibility
}

interface PortfolioHeatmapProps {
 holdings: Array<{
 asset: string;
 symbol: string;
 marketValue: number;
 allocation: number;
 change24h: number;
 lastPrice: number;
 }>;
 totalValue: number;
}

export default function PortfolioHeatmap({ holdings, totalValue }: PortfolioHeatmapProps) {
 const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);

 // Transform holdings to heatmap data format
 const enhancedHeatmapData: HeatmapData[] = useMemo(() => {
 // Determine color based on performance
 const getPerformanceColor = (change: number) => {
 if (change > 10) return '#059669'; // dark green
 if (change > 5) return '#10b981'; // bright green
 if (change > 2) return '#22c55e'; // green
 if (change > 0) return '#84cc16'; // light green
 if (change > -2) return '#eab308'; // yellow
 if (change > -5) return '#f97316'; // orange
 if (change > -10) return '#ef4444'; // red
 return '#dc2626'; // dark red
 };

 // Convert holdings to heatmap format
 return holdings.map(holding => ({
 name: holding.symbol,
 value: holding.marketValue,
 allocation: holding.allocation,
 change24h: holding.change24h,
 price: holding.lastPrice,
 color: getPerformanceColor(holding.change24h)
 })).sort((a, b) => b.value - a.value);
 }, [holdings]);

 // Custom content renderer for treemap cells
 const CustomizedContent = (props: any) => {
 const { root, depth, x, y, width, height, index, name, value, allocation, change24h } = props;
 
 // Only show content for leaf nodes and if cell is large enough
 if (depth !== 1 || width < 60 || height < 40) return null;

 return (
 <g>
 <rect
 x={x}
 y={y}
 width={width}
 height={height}
 style={{
 fill: props.color,
 stroke: 'hsl(var(--card))',
 strokeWidth: 2,
 opacity: hoveredAsset === name ? 1 : 0.9,
 cursor: 'pointer'
 }}
 onMouseEnter={() => setHoveredAsset(name)}
 onMouseLeave={() => setHoveredAsset(null)}
 />
 
 {/* Asset symbol */}
 {width > 80 && height > 60 && (
 <text
 x={x + width / 2}
 y={y + height / 2 - 8}
 textAnchor="middle"
 fill="white"
 fontSize={Math.min(width / 4, height / 4, 16)}
 fontWeight="bold"
 style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
 >
 {name}
 </text>
 )}
 
 {/* Allocation percentage */}
 {width > 100 && height > 80 && (
 <text
 x={x + width / 2}
 y={y + height / 2 + 8}
 textAnchor="middle"
 fill="white"
 fontSize={Math.min(width / 6, height / 6, 12)}
 style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
 >
 {allocation.toFixed(1)}%
 </text>
 )}
 
 {/* Change percentage */}
 {width > 120 && height > 100 && (
 <text
 x={x + width / 2}
 y={y + height / 2 + 24}
 textAnchor="middle"
 fill="white"
 fontSize={Math.min(width / 8, height / 8, 10)}
 fontWeight="bold"
 style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
 >
 {change24h >= 0 ? '+' : ''}{change24h.toFixed(1)}%
 </text>
 )}
 </g>
 );
 };

 // Custom tooltip component
 const CustomTooltip = ({ active, payload }: any) => {
 if (active && payload && payload.length) {
 const data = payload[0].payload;
 return (
 <div className="bg-popover text-popover-foreground border-border rounded-lg border p-4 shadow-lg">
 <div className="mb-2 text-lg font-bold">{data.name}</div>
 <div className="space-y-1">
 <div className="flex justify-between gap-4">
 <span className="text-muted-foreground">Allocation:</span>
 <span className="font-mono font-semibold tabular-nums">
 {data.allocation.toFixed(1)}%
 </span>
 </div>
 <div className="flex justify-between gap-4">
 <span className="text-muted-foreground">Value:</span>
 <span className="font-mono font-semibold tabular-nums">
 ${data.value.toLocaleString()}
 </span>
 </div>
 <div className="flex justify-between gap-4">
 <span className="text-muted-foreground">24h Change:</span>
 <span
 className={`font-mono font-semibold tabular-nums ${
 data.change24h >= 0 ? "text-vaultx-success" : "text-vaultx-danger"
 }`}
 >
 {data.change24h >= 0 ? "+" : ""}
 {data.change24h.toFixed(2)}%
 </span>
 </div>
 <div className="flex justify-between gap-4">
 <span className="text-muted-foreground">Price:</span>
 <span className="font-mono tabular-nums">${data.price.toLocaleString()}</span>
 </div>
 </div>
 </div>
 );
 }
 return null;
 };

 return (
 <Card className="p-6">
 <div className="mb-6 flex items-center justify-between">
 <h3 className="font-heading text-lg font-bold">Portfolio Heatmap</h3>
 {/* Swatches mirror the performance ramp below, which is a data scale
 rather than chrome, so they stay literal in both themes. */}
 <div className="text-muted-foreground flex items-center gap-4 text-xs">
 <div className="flex items-center gap-2">
 <div className="bg-vaultx-success h-3 w-3 rounded-sm" />
 <span>Positive</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="bg-vaultx-danger h-3 w-3 rounded-sm" />
 <span>Negative</span>
 </div>
 </div>
 </div>

 <div className="text-muted-foreground mb-4 text-sm">
 Size = Allocation • Color = 24h Performance
 </div>

 <div className="w-full" style={{ height: '320px' }}>
 <ResponsiveContainer width="100%" height={320}>
 <Treemap
 data={enhancedHeatmapData}
 dataKey="value"
 aspectRatio={4/3}
 stroke="none"
 content={<CustomizedContent />}
 >
 <Tooltip content={<CustomTooltip />} />
 </Treemap>
 </ResponsiveContainer>
 </div>

 {/* Performance Summary */}
 <div className="mt-4 flex items-center justify-between text-sm">
 <div className="text-muted-foreground">
 {enhancedHeatmapData.filter((d: HeatmapData) => d.change24h > 0).length} assets up •{" "}
 {enhancedHeatmapData.filter((d: HeatmapData) => d.change24h <= 0).length} assets down
 </div>
 <div className="text-foreground">
 Largest holding: {enhancedHeatmapData[0]?.name} (
 {enhancedHeatmapData[0]?.allocation.toFixed(1)}%)
 </div>
 </div>
 </Card>
 );
}