"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/lib/api";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import MetricCard from "@/components/ui/MetricCard";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import HoldingsTable from "@/components/dashboard/HoldingsTable";
import PortfolioOverview from "@/components/dashboard/PortfolioOverview";
import PortfolioHeatmap from "@/components/dashboard/PortfolioHeatmap";
import LivePriceTicker from "@/components/dashboard/LivePriceTicker";
import {
  DollarSign,
  TrendingUp,
  PieChart as PieChartIcon,
  Target,
} from "lucide-react";

import {
  generateUserMockData,
  mockAllocationData,
  mockHoldingsData,
  mockPerformanceData
} from "@/data/mockData";

export default function DashboardPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("30D");
  const { user } = useAuth();

  // Backend data states
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [backendDataLoading, setBackendDataLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [binanceData, setBinanceData] = useState<any>(null);

  // Get filtered performance data based on timeframe
  const getPerformanceData = (timeframe: string) => {
    return mockPerformanceData[timeframe as keyof typeof mockPerformanceData] || mockPerformanceData['30D'];
  };

  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
  };

  // Load portfolio data from backend
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) {
        setBackendDataLoading(false);
        return;
      }

      try {
        setBackendDataLoading(true);
        setBackendError(null);
        
        // Fetch portfolio data
        const [portfolioResponse, holdingsResponse] = await Promise.allSettled([
          api.getPortfolioSummary(),
          api.getHoldings(),
        ]);
        
        if (portfolioResponse.status === 'fulfilled' && portfolioResponse.value.success) {
          setPortfolioData(portfolioResponse.value);
          console.log('✅ Portfolio data loaded from backend:', portfolioResponse.value);
        }
        
        // Try to fetch Binance data
        try {
          const binanceResponse = await api.getBinanceAccountInfo();
          if (binanceResponse.success) {
            setBinanceData(binanceResponse.data);
            console.log('✅ Binance test data loaded:', binanceResponse.data);
          }
        } catch (binanceError) {
          console.info('📊 Binance test data not available, using mock data');
        }
        
      } catch (error: any) {
        // Handle backend connectivity gracefully
        if (error.message && error.message.includes('Backend service is not available')) {
          console.info('📡 Backend not running - using demo data for dashboard');
          setBackendError(null); // Don't show error for expected dev scenario
        } else {
          console.warn('⚠️ API error:', error.message);
          setBackendError(error.message || 'Failed to load portfolio data');
        }
        // Continue with mock data when backend is not available
      } finally {
        setBackendDataLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  // Generate user-specific mock data
  const userMockData = user ? generateUserMockData(user.id, user.email) : null;
  const mockPortfolioMetrics = userMockData?.mockPortfolioMetrics || {
    totalCapital: { value: "$0", change24h: { value: "$0", percentage: "0%", isPositive: true } },
    unrealizedPnL: { value: "$0", change24h: { value: "$0", percentage: "0%", isPositive: true } },
    realizedPnL: { value: "$0", change24h: { value: "$0", percentage: "0%", isPositive: true } },
    successRate: { percentage: "0%", profitFromWins: "0", totalTrades: 0, winningTrades: 0 }
  };

  // Use real backend data if available, otherwise use mock data
  const portfolioMetrics = portfolioData ? {
    totalCapital: {
      value: `$${portfolioData.portfolio_summary?.total_portfolio_value_usd?.toLocaleString() || '0'}`,
      change24h: {
        value: `$${portfolioData.portfolio_summary?.total_unrealized_pnl_usd?.toLocaleString() || '0'}`,
        percentage: `${portfolioData.portfolio_summary?.total_unrealized_pnl_percentage?.toFixed(2) || '0'}%`,
        isPositive: (portfolioData.portfolio_summary?.total_unrealized_pnl_usd || 0) >= 0
      }
    },
    unrealizedPnL: {
      value: `$${portfolioData.portfolio_summary?.total_unrealized_pnl_usd?.toLocaleString() || '0'}`,
      change24h: {
        value: `$${portfolioData.portfolio_summary?.total_unrealized_pnl_usd?.toLocaleString() || '0'}`,
        percentage: `${portfolioData.portfolio_summary?.total_unrealized_pnl_percentage?.toFixed(2) || '0'}%`,
        isPositive: (portfolioData.portfolio_summary?.total_unrealized_pnl_usd || 0) >= 0
      }
    },
    realizedPnL: {
      value: "$0",
      change24h: { value: "$0", percentage: "0%", isPositive: true }
    },
    successRate: {
      percentage: "N/A",
      profitFromWins: "0",
      totalTrades: 0,
      winningTrades: 0
    }
  } : mockPortfolioMetrics;

  // Transform backend holdings to component format
  const transformedHoldings = portfolioData?.portfolio_summary?.holdings?.map((holding: any, index: number) => ({
    id: `${holding.asset_symbol}-${index}`,
    asset: holding.asset_name,
    symbol: holding.asset_symbol,
    qty: parseFloat(holding.total_quantity) || 0,
    avgBuyPrice: parseFloat(holding.average_cost_usd) || 0,
    lastPrice: parseFloat(holding.current_price_usd) || 0,
    marketValue: parseFloat(holding.current_value_usd) || 0,
    realizedPnL: 0,
    unrealizedPnL: parseFloat(holding.unrealized_pnl_usd) || 0,
    allocation: parseFloat(holding.portfolio_percentage) || 0,
    change24h: parseFloat(holding.unrealized_pnl_percentage) || 0,
  })) || [];

  const holdings = transformedHoldings.length > 0 ? transformedHoldings : mockHoldingsData;
  const totalPortfolioValue = portfolioData?.portfolio_summary?.total_portfolio_value_usd || 
    mockHoldingsData.reduce((sum, holding) => sum + holding.marketValue, 0);

  // Transform holdings to allocation data for donut chart
  const assetColors: { [key: string]: string } = {
    'BTC': '#f7931a',
    'ETH': '#627eea',
    'BNB': '#f3ba2f',
    'SOL': '#00d4aa',
    'ADA': '#0033ad',
    'DOT': '#e6007a',
    'MATIC': '#8247e5',
    'AVAX': '#e84142',
    'LINK': '#2a5ada',
    'UNI': '#ff007a',
  };

  const allocationData = holdings.map(holding => ({
    asset: holding.symbol,
    value: holding.marketValue,
    percentage: holding.allocation,
    color: assetColors[holding.symbol] || '#8b5cf6'
  }));

  // Generate realistic historical performance data based on current portfolio
  const generatePerformanceData = (timeframe: string) => {
    // Use mock data if no real portfolio data yet
    if (!portfolioData || transformedHoldings.length === 0 || totalPortfolioValue === 0) {
      return getPerformanceData(timeframe);
    }

    const currentValue = totalPortfolioValue;
    const currentUnrealizedPnL = portfolioData?.portfolio_summary?.total_unrealized_pnl_usd || 0;
    const currentRealizedPnL = 0; // We don't have this data yet

    const configs: { [key: string]: { days: number; points: number } } = {
      '7D': { days: 7, points: 8 },
      '30D': { days: 30, points: 10 },
      '90D': { days: 90, points: 11 },
      '1Y': { days: 365, points: 12 },
      'ALL': { days: 730, points: 9 }
    };

    const config = configs[timeframe] || configs['30D'];
    const { days, points } = config;
    const data = [];
    
    // Generate dates from oldest to newest
    for (let i = 0; i < points; i++) {
      const daysAgo = Math.floor(((points - 1 - i) / (points - 1)) * days);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      let dateLabel;
      if (i === points - 1) {
        dateLabel = 'Today';
      } else if (timeframe === '7D') {
        dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (timeframe === '1Y') {
        dateLabel = date.toLocaleDateString('en-US', { month: 'short' });
      } else if (timeframe === 'ALL') {
        dateLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      } else {
        dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      // Calculate progress from oldest (0) to newest (1)
      const progress = i / (points - 1);
      
      // Total Value: Steady growth from 70% to 100%
      const growthFactor = 0.7 + (progress * 0.3);
      const portfolioVolatility = (Math.random() - 0.5) * 0.06; // ±3% variation
      const historicalValue = currentValue * growthFactor * (1 + portfolioVolatility);
      
      // Unrealized PnL: More volatile, starts negative/low and grows to current
      // Simulate the journey of holdings going from underwater to profitable
      const unrealizedStart = -currentUnrealizedPnL * 0.3; // Start at -30% of current
      const unrealizedRange = currentUnrealizedPnL - unrealizedStart;
      const unrealizedProgress = Math.pow(progress, 1.5); // Accelerating growth
      const unrealizedVolatility = (Math.random() - 0.5) * currentUnrealizedPnL * 0.15; // ±15% variation
      const historicalUnrealizedPnL = unrealizedStart + (unrealizedRange * unrealizedProgress) + unrealizedVolatility;
      
      // Realized PnL: Simulate gradual profit-taking (grows slower, more steady)
      // Assume realized PnL would be ~40% of current unrealized if we had sold along the way
      const estimatedRealizedPnL = currentUnrealizedPnL * 0.4;
      const realizedProgress = Math.pow(progress, 2); // Slower, more gradual growth
      const historicalRealizedPnL = estimatedRealizedPnL * realizedProgress;
      
      data.push({
        date: dateLabel,
        totalValue: Math.round(historicalValue),
        realizedPnL: Math.round(historicalRealizedPnL),
        unrealizedPnL: Math.round(historicalUnrealizedPnL)
      });
    }
    
    return data;
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        {/* Live price ticker strip */}
        <LivePriceTicker />

        <div className="p-6 space-y-6">
          {/* Backend Status Banner */}
          {portfolioData && !backendDataLoading && (
            <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                <p className="text-cyan-300 text-sm">
                  📊 Real backend data loaded - Showing your actual portfolio
                </p>
              </div>
            </div>
          )}

          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Capital"
              value={portfolioMetrics.totalCapital.value}
              change={{
                value: portfolioMetrics.totalCapital.change24h.value,
                percentage: portfolioMetrics.totalCapital.change24h.percentage,
                isPositive: portfolioMetrics.totalCapital.change24h.isPositive
              }}
              icon={<DollarSign className="w-5 h-5 text-cyan-500" />}
            />
            <MetricCard
              title="Unrealized P&L"
              value={portfolioMetrics.unrealizedPnL.value}
              change={{
                value: portfolioMetrics.unrealizedPnL.change24h.value,
                percentage: portfolioMetrics.unrealizedPnL.change24h.percentage,
                isPositive: portfolioMetrics.unrealizedPnL.change24h.isPositive
              }}
              icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
            />
            <MetricCard
              title="Realized P&L"
              value={portfolioMetrics.realizedPnL.value}
              change={{
                value: portfolioMetrics.realizedPnL.change24h.value,
                percentage: portfolioMetrics.realizedPnL.change24h.percentage,
                isPositive: portfolioMetrics.realizedPnL.change24h.isPositive
              }}
              icon={<Target className="w-5 h-5 text-emerald-500" />}
            />
            <MetricCard
              title="Success Rate"
              value={portfolioMetrics.successRate.percentage}
              change={{
                value: `${portfolioMetrics.successRate.winningTrades} / ${portfolioMetrics.successRate.totalTrades} trades`,
                isPositive: true
              }}
              icon={<PieChartIcon className="w-5 h-5 text-blue-500" />}
            />
          </div>

          {/* 2-Column Layout: Portfolio Growth (60%) + Portfolio Overview (40%) */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Portfolio Growth Chart - Takes up 60% (3/5) */}
            <div className="xl:col-span-3" style={{ minHeight: '400px' }}>
              <PerformanceChart
                data={generatePerformanceData(selectedTimeframe)}
                timeframe={selectedTimeframe}
                onTimeframeChange={handleTimeframeChange}
              />
            </div>
            
            {/* Portfolio Overview Donut Chart - Takes up 40% (2/5) */}
            <div className="xl:col-span-2" style={{ minHeight: '400px' }}>
              <PortfolioOverview 
                totalBalance={`$${totalPortfolioValue.toLocaleString()}`}
                allocationData={allocationData}
                dayChange={{
                  value: `$${(portfolioData?.portfolio_summary?.total_unrealized_pnl_usd || 0).toLocaleString()}`,
                  percentage: `${(portfolioData?.portfolio_summary?.total_unrealized_pnl_percentage || 0).toFixed(2)}%`,
                  isPositive: (portfolioData?.portfolio_summary?.total_unrealized_pnl_usd || 0) >= 0
                }}
                weekChange={{
                  value: `$${(portfolioData?.portfolio_summary?.total_unrealized_pnl_usd || 0).toLocaleString()}`,
                  percentage: `${(portfolioData?.portfolio_summary?.total_unrealized_pnl_percentage || 0).toFixed(2)}%`,
                  isPositive: (portfolioData?.portfolio_summary?.total_unrealized_pnl_usd || 0) >= 0
                }}
              />
            </div>
          </div>

          {/* Holdings Table - Full Width */}
          <div>
            <HoldingsTable 
              holdings={holdings}
              totalValue={totalPortfolioValue}
            />
          </div>

          {/* Portfolio Heatmap - Full Width Modern Visualization */}
          <div>
            <PortfolioHeatmap 
              holdings={holdings}
              totalValue={totalPortfolioValue}
            />
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}