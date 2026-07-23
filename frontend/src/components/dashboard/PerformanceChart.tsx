import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, Line, ComposedChart, Tooltip } from 'recharts';
import { useState, useMemo } from 'react';

interface PerformanceData {
  date: string;
  totalValue: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
  timeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover backdrop-blur-sm border border-border rounded-lg p-4 shadow-xl">
        <p className="text-foreground text-sm font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-foreground">{entry.name}:</span>
            <span className="text-sm font-bold text-foreground">
              {entry.name.includes('PnL') ? 
                `${entry.value >= 0 ? '+' : ''}$${(entry.value / 1000).toFixed(1)}K` : 
                `$${(entry.value / 1000000).toFixed(2)}M`
              }
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PerformanceChart({ 
  data, 
  timeframe: propTimeframe, 
  onTimeframeChange 
}: PerformanceChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState(propTimeframe || '30D');
  const timeframes = ['7D', '30D', '90D', '1Y', 'ALL'];
  
  const currentTimeframe = propTimeframe || selectedTimeframe;

  // Use the data as-is since it's already filtered for the selected timeframe
  const filteredData = useMemo(() => {
    return data && data.length > 0 ? data : [];
  }, [data]);

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatPnLValue = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    if (Math.abs(value) >= 1000) {
      return `${sign}$${(value / 1000).toFixed(0)}K`;
    }
    return `${sign}$${value.toFixed(0)}`;
  };

  const handleTimeframeChange = (tf: string) => {
    if (onTimeframeChange) {
      onTimeframeChange(tf);
    } else {
      setSelectedTimeframe(tf);
    }
  };

  // Calculate min and max values for proper scaling
  const allValues = filteredData.flatMap(d => [d.totalValue, d.realizedPnL, d.unrealizedPnL]);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  
  // Create domain with padding for better visualization
  const padding = (maxValue - minValue) * 0.1;
  const yAxisDomain = [
    Math.max(0, minValue - padding), 
    maxValue + padding
  ];

  // Calculate period performance
  const firstValue = filteredData[0]?.totalValue || 0;
  const lastValue = filteredData[filteredData.length - 1]?.totalValue || 0;
  const periodGrowth = firstValue ? ((lastValue - firstValue) / firstValue * 100) : 0;

  return (
    <div className="bg-card border-border rounded-lg border p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Portfolio Growth Over Time</h3>
        
        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 sm:p-1.5 border border-border shadow-lg overflow-x-auto">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-2 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 ${
                currentTimeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="mt-4 relative" style={{ height: '320px' }}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart 
            data={filteredData} 
            margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
          >
            <defs>
              {/* Enhanced gradients for better visual appeal */}
              <linearGradient id="totalValueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                <stop offset="30%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="70%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="2 4" 
              stroke="hsl(var(--border))" 
              strokeOpacity={0.4}
              horizontal={true}
              vertical={false}
            />
            
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              dy={10}
            />
            
            {/* Primary Y-axis for Total Value */}
            <YAxis 
              yAxisId="left"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatValue}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              dx={-10}
              domain={yAxisDomain}
            />
            
            {/* Secondary Y-axis for PnL values */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatPnLValue}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              dx={10}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Total Value Area - Primary axis */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="totalValue"
              stroke="hsl(var(--chart-1))"
              strokeWidth={4}
              fill="url(#totalValueGradient)"
              dot={false}
              activeDot={{ 
                r: 8, 
                stroke: 'hsl(var(--chart-1))', 
                strokeWidth: 3, 
                fill: 'hsl(var(--card))',
                filter: 'none'
              }}
              name="Total Value"
            />
            
            {/* Realized PnL Line - Secondary axis */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="realizedPnL"
              stroke="hsl(var(--chart-2))"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 4 }}
              activeDot={{ 
                r: 7, 
                stroke: 'hsl(var(--chart-2))', 
                strokeWidth: 2, 
                fill: 'hsl(var(--card))'
              }}
              name="Realized PnL"
            />
            
            {/* Unrealized PnL Line - Secondary axis */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="unrealizedPnL"
              stroke="hsl(var(--chart-4))"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--chart-4))', strokeWidth: 2, r: 4 }}
              activeDot={{ 
                r: 7, 
                stroke: 'hsl(var(--chart-4))', 
                strokeWidth: 2, 
                fill: 'hsl(var(--card))'
              }}
              name="Unrealized PnL"
            />
          </ComposedChart>
        </ResponsiveContainer>
        
      </div>

      {/* Enhanced Legend and Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative">
              <div className="w-4 h-4 bg-primary rounded-full shadow-lg shadow-cyan-400/30 group-hover:shadow-cyan-400/50 transition-shadow" />
              <div className="absolute inset-0 w-4 h-4 bg-primary rounded-full animate-ping opacity-20" />
            </div>
            <span className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">Total Value</span>
          </div>
          
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative">
              <div className="w-4 h-4 bg-vaultx-success rounded-full shadow-lg shadow-emerald-400/30 group-hover:shadow-emerald-400/50 transition-shadow" />
            </div>
            <span className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">Realized PnL</span>
          </div>
          
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative">
              <div className="w-4 h-4 bg-vaultx-warning rounded-full shadow-lg shadow-amber-400/30 group-hover:shadow-amber-400/50 transition-shadow" />
            </div>
            <span className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">Unrealized PnL</span>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-sm font-medium text-muted-foreground mb-1">Period Growth</div>
          <div className={`text-xl font-bold tracking-tight flex items-center gap-2 ${
            periodGrowth >= 0 ? 'text-vaultx-success' : 'text-vaultx-danger'
          }`}>
            <span className={`text-sm ${periodGrowth >= 0 ? 'text-vaultx-success' : 'text-vaultx-danger'}`}>
              {periodGrowth >= 0 ? '↗' : '↘'}
            </span>
            {periodGrowth >= 0 ? '+' : ''}{periodGrowth.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}