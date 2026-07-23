import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target, DollarSign } from 'lucide-react';

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
}

interface PortfolioMetrics {
  totalCapital: {
    value: string;
    change24h: {
      value: string;
      percentage: string;
      isPositive: boolean;
    };
  };
  unrealizedPnL: {
    value: string;
    change24h: {
      value: string;
      percentage: string;
      isPositive: boolean;
    };
  };
  realizedPnL: {
    value: string;
    change24h: {
      value: string;
      percentage: string;
      isPositive: boolean;
    };
  };
}

interface InsightsProps {
  holdings: HoldingData[];
  metrics: PortfolioMetrics;
  totalValue: number;
}

export default function DynamicInsights({ holdings, metrics, totalValue }: InsightsProps) {
  // Calculate best and worst performers
  const bestPerformer = holdings.reduce((best, current) => 
    current.change24h > best.change24h ? current : best
  );
  
  const worstPerformer = holdings.reduce((worst, current) => 
    current.change24h < worst.change24h ? current : worst
  );

  // Calculate portfolio concentration risk
  const topThreeAllocation = holdings
    .sort((a, b) => b.allocation - a.allocation)
    .slice(0, 3)
    .reduce((sum, holding) => sum + holding.allocation, 0);

  // Generate dynamic insights based on data
  const generateInsights = () => {
    const insights = [];

    // Performance insight
    if (bestPerformer.change24h > 5) {
      insights.push({
        type: 'success' as const,
        icon: <TrendingUp className="w-4 h-4" />,
        title: 'Strong Performance',
        message: `${bestPerformer.symbol} is your best performer today (+${bestPerformer.change24h.toFixed(1)}%). Consider taking profits.`
      });
    }

    // Risk insight
    if (topThreeAllocation > 80) {
      insights.push({
        type: 'warning' as const,
        icon: <AlertTriangle className="w-4 h-4" />,
        title: 'Concentration Risk',
        message: `Your top 3 assets represent ${topThreeAllocation.toFixed(1)}% of your portfolio. Consider diversification.`
      });
    } else {
      insights.push({
        type: 'success' as const,
        icon: <CheckCircle className="w-4 h-4" />,
        title: 'Well Diversified',
        message: `Good diversification! Your top 3 assets represent ${topThreeAllocation.toFixed(1)}% of your portfolio.`
      });
    }

    // Profit insight
    const totalUnrealizedPnL = holdings.reduce((sum, holding) => sum + holding.unrealizedPnL, 0);
    const totalRealizedPnL = holdings.reduce((sum, holding) => sum + holding.realizedPnL, 0);
    
    if (totalUnrealizedPnL > totalRealizedPnL * 0.1) {
      insights.push({
        type: 'info' as const,
        icon: <DollarSign className="w-4 h-4" />,
        title: 'Profit Taking',
        message: `You have $${Math.abs(totalUnrealizedPnL).toLocaleString()} in unrealized gains. Consider realizing some profits.`
      });
    }

    return insights.slice(0, 3); // Return top 3 insights
  };

  const insights = generateInsights();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-card border-border rounded-lg border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground">PERFORMANCE & INSIGHTS</h3>
        <button className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 p-2 rounded-lg">
          <Target className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Performance Overview */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-secondary/40 rounded-lg p-3 border border-border hover:border-vaultx-success/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Best Performer</span>
              <TrendingUp className="w-4 h-4 text-vaultx-success" />
            </div>
            <div className="mt-2">
              <div className="text-foreground font-bold text-sm">{bestPerformer.symbol}</div>
              <div className="text-vaultx-success font-semibold text-lg">+{bestPerformer.change24h.toFixed(1)}%</div>
            </div>
          </div>

          <div className="bg-secondary/40 rounded-lg p-3 border border-border hover:border-vaultx-danger/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Worst Performer</span>
              <TrendingDown className="w-4 h-4 text-vaultx-danger" />
            </div>
            <div className="mt-2">
              <div className="text-foreground font-bold text-sm">{worstPerformer.symbol}</div>
              <div className="text-vaultx-danger font-semibold text-lg">{worstPerformer.change24h.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Dynamic Insights */}
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                insight.type === 'success' 
                  ? 'bg-vaultx-success/10 border-vaultx-success/40 hover:border-vaultx-success/40' 
                  : insight.type === 'warning'
                  ? 'bg-vaultx-warning/10 border-vaultx-warning/40 hover:border-vaultx-warning/40'
                  : 'bg-primary/10 border-primary/40 hover:border-primary/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${
                  insight.type === 'success' 
                    ? 'text-vaultx-success' 
                    : insight.type === 'warning'
                    ? 'text-vaultx-warning'
                    : 'text-primary'
                }`}>
                  {insight.icon}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground text-sm mb-1">{insight.title}</div>
                  <div className="text-foreground text-xs leading-relaxed">{insight.message}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-border">
          <div className="flex gap-2">
            <button className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors active:scale-[0.98]">
              Rebalance
            </button>
            <button className="border-border text-foreground hover:bg-accent flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.98]">
              Analyze
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}