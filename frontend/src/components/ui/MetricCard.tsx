"use client";

import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    percentage?: string;
    isPositive: boolean;
  };
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  index?: number;
}

export default function MetricCard({ 
  title, 
  value, 
  change, 
  icon,
  className = "",
  index = 0
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(6, 182, 212, 0.4)" }}
      className={`bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 transition-colors duration-300 hover:shadow-lg hover:shadow-cyan-500/5 ${className}`}
    >
      {/* Header with Icon and Title */}
      <div className="flex items-center gap-3 mb-6">
        {icon && (
          <motion.div 
            whileHover={{ rotate: 12, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center cursor-pointer"
          >
            {icon}
          </motion.div>
        )}
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</h3>
      </div>

      {/* Main Value */}
      <div className="mb-4">
        <motion.div 
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-3xl font-bold text-white tracking-tight"
        >
          {value}
        </motion.div>
      </div>

      {/* 24h Change */}
      {change && (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${
            change.isPositive ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {change.value}
          </span>
          {change.percentage && (
            <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
              {change.percentage}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}