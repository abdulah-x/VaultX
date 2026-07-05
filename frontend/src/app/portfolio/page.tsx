"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { portfolioApi } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import HoldingsTable from "@/components/dashboard/HoldingsTable";
import PortfolioOverview from "@/components/dashboard/PortfolioOverview";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import { mockPerformanceData } from "@/data/mockData";

export default function PortfolioPage() {
  const { user } = useAuth();
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("30D");

  useEffect(() => {
    const fetchPortfolioData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const data = await portfolioApi.get();
        setPortfolioData(data);
        setError(null);
      } catch (err: any) {
        // Handle backend connectivity gracefully
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('ERR_NETWORK'))) {
          console.info('📡 Backend not running - using demo data for portfolio');
          setError(null); // Don't show error for expected dev scenario
        } else {
          console.warn('⚠️ API error:', err.message);
          setError('API error - displaying mock data');
        }
        // Continue to show mock data even when backend is not available
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioData();
  }, [user]);

  const getPerformanceData = (timeframe: string) => {
    return mockPerformanceData[timeframe as keyof typeof mockPerformanceData] || mockPerformanceData['30D'];
  };

  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
  };

  const mockPortfolioData = {
    holdings: [
      {
        id: 'btc',
        asset: 'Bitcoin',
        symbol: 'BTC',
        qty: 0.0234,
        avgBuyPrice: 60500,
        lastPrice: 67500,
        marketValue: 1579.5,
        realizedPnL: 0,
        unrealizedPnL: 163.7,
        allocation: 45.4,
        change24h: 1.1,
      },
      {
        id: 'eth',
        asset: 'Ethereum',
        symbol: 'ETH',
        qty: 0.456,
        avgBuyPrice: 3600,
        lastPrice: 3800,
        marketValue: 1732.8,
        realizedPnL: 0,
        unrealizedPnL: 91.2,
        allocation: 49.8,
        change24h: 0.7,
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        quantity: 2.1,
        marketPrice: 84.5,
        marketValue: 177.45,
        pnl: '-$12.1',
        pnlPercentage: '-6.37%',
        allocation: 5.1,
        change24h: -2.3,
        isPositive: false
      }
    ],
    total_portfolio_value_usd: 3489.75
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading portfolio data...</p>
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
              <p className="text-gray-400 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="p-6 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Status Banner */}
            {error && (
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <p className="text-yellow-300 text-sm">
                    {error} - Showing demonstration data
                  </p>
                </div>
              </div>
            )}
            
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Portfolio Management</h1>
              <p className="text-gray-400">
                Complete overview of your cryptocurrency holdings and performance
              </p>
            </div>

            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                <h3 className="text-gray-400 text-sm font-medium mb-2">Total Value</h3>
                <p className="text-2xl font-bold text-white">
                  ${portfolioData?.total_portfolio_value_usd?.toLocaleString() || '3,489.75'}
                </p>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                <h3 className="text-gray-400 text-sm font-medium mb-2">Total P&L</h3>
                <p className="text-2xl font-bold text-green-400">
                  +${portfolioData?.total_unrealized_pnl_usd?.toLocaleString() || '234.50'}
                </p>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                <h3 className="text-gray-400 text-sm font-medium mb-2">Assets Count</h3>
                <p className="text-2xl font-bold text-white">
                  {portfolioData?.asset_count || 3}
                </p>
              </div>
            </div>

            {/* Performance Chart and Overview */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Performance Chart - Takes up 60% (3/5) */}
              <div className="xl:col-span-3">
                <PerformanceChart
                  data={getPerformanceData(selectedTimeframe)}
                  timeframe={selectedTimeframe}
                  onTimeframeChange={handleTimeframeChange}
                />
              </div>
              
              {/* Portfolio Overview - Takes up 40% (2/5) */}
              <div className="xl:col-span-2">
                <PortfolioOverview 
                  totalBalance="$3,489.75"
                  allocationData={[
                    { asset: 'Bitcoin', value: 1585.9, percentage: 45.4, color: '#F59E0B', symbol: 'BTC' },
                    { asset: 'Ethereum', value: 1737.9, percentage: 49.8, color: '#3B82F6', symbol: 'ETH' },
                    { asset: 'Solana', value: 178.0, percentage: 5.1, color: '#8B5CF6', symbol: 'SOL' }
                  ]}
                  dayChange={{
                    value: "+$124.32",
                    percentage: "+3.69%",
                    isPositive: true
                  }}
                  weekChange={{
                    value: "+$287.65",
                    percentage: "+8.99%",
                    isPositive: true
                  }}
                />
              </div>
            </div>

            {/* Holdings Table */}
            <div>
              <HoldingsTable 
                holdings={portfolioData?.holdings || mockPortfolioData.holdings} 
                totalValue={portfolioData?.total_portfolio_value_usd || mockPortfolioData.total_portfolio_value_usd}
              />
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}