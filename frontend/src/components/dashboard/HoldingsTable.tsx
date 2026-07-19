"use client";

import { motion } from "framer-motion";
import { MoreHorizontal, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';

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

const tableVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 350, damping: 25 } }
};

export default function HoldingsTable({ holdings, totalValue }: HoldingsTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatNumber = (value: number, decimals: number = 4) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden"
    >
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">ASSET HOLDINGS</h3>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors p-2 rounded-lg"
          >
            <MoreHorizontal className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Asset
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Avg Buy Price
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Market Price
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Market Value
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Unrealized PnL
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                24h Change
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Allocation
              </th>
            </tr>
          </thead>
          <motion.tbody 
            variants={tableVariants}
            initial="hidden"
            animate="show"
            className="divide-y divide-gray-800"
          >
            {holdings.map((holding) => (
              <motion.tr 
                key={holding.id}
                variants={rowVariants}
                className="hover:bg-gray-800/50 hover:shadow-lg cursor-pointer transition-colors duration-200 group border-l-4 border-transparent hover:border-cyan-500/50"
                onClick={() => {/* TODO: Navigate to asset detail page */}}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: 10 }}
                      className="w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full flex items-center justify-center shadow"
                    >
                      <span className="text-xs font-bold text-white">
                        {holding.symbol.slice(0, 1)}
                      </span>
                    </motion.div>
                    <div>
                      <div className="text-sm font-medium text-white">{holding.asset}</div>
                      <div className="text-xs text-gray-400">{holding.symbol}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-white font-mono">
                    {formatNumber(holding.qty)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-white font-mono">
                    {formatCurrency(holding.avgBuyPrice)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-white font-mono">
                    {formatCurrency(holding.lastPrice)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-white font-mono">
                    {formatCurrency(holding.marketValue)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {((holding.marketValue / totalValue) * 100).toFixed(1)}% of portfolio
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className={`text-sm font-medium flex items-center justify-end gap-1 ${
                    holding.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {holding.unrealizedPnL >= 0 ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {formatCurrency(Math.abs(holding.unrealizedPnL))}
                  </div>
                  <div className={`text-xs ${
                    holding.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatPercentage(((holding.lastPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
                  <div className={`text-sm font-medium flex items-center justify-end gap-1 ${
                    holding.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {holding.change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {formatPercentage(holding.change24h)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="w-16 bg-gray-800 rounded-full h-2 overflow-hidden ml-auto">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${holding.allocation}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full"
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {holding.allocation.toFixed(1)}%
                  </div>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </motion.div>
  );
}