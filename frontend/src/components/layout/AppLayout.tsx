"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  PieChart as PieChartIcon,
  Target,
  Activity,
  BarChart3,
  Search,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  BellOff,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

interface AppLayoutProps {
  children: ReactNode;
}

// ── Animation variants ────────────────────────────────────────────────────
const sidebarVariants = {
  open:   { x: 0,    opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
  closed: { x: -280, opacity: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
};

const dropdownVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" as const } },
  exit:   { opacity: 0, scale: 0.95, y: -8, transition: { duration: 0.1 } },
};

const navItemVariants = {
  hidden:  { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: "easeOut" as const },
  }),
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Navigation items — kept in sync with actual /app routes
  const navigationItems = [
    { name: "Dashboard",       href: "/dashboard", icon: BarChart3     },
    { name: "Portfolio",       href: "/portfolio", icon: PieChartIcon  },
    { name: "Markets Overview",href: "/markets",   icon: TrendingUp    },
    { name: "Trade History",   href: "/trades",    icon: Activity      },
    { name: "Analytics",       href: "/analytics", icon: Target        },
    { name: "AI Advisor",      href: "/advisor",   icon: Sparkles, highlight: true },
    { name: "Settings",        href: "/settings",  icon: Settings      },
  ];

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    if (userMenuOpen || notificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen, notificationsOpen]);

  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
    if (user?.firstName) return user.firstName;
    if (user?.email) return user.email.split("@")[0];
    return "Portfolio Owner";
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    if (user?.firstName) return user.firstName.substring(0, 2).toUpperCase();
    if (user?.email) return user.email.substring(0, 2).toUpperCase();
    return "PO";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
            <BarChart3 className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="text-white text-lg font-medium">Loading Portfolio...</div>
          <div className="text-gray-400 text-sm mt-2">Please wait while we prepare your dashboard</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800"
      >
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left — Logo + user */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={{ rotate: 8, scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
                >
                  <BarChart3 className="w-5 h-5 text-white" />
                </motion.div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-white">VaultX</h1>
                  <p className="text-xs text-gray-400 tracking-wider">PORTFOLIO MANAGER</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center overflow-hidden border border-gray-600">
                  {!imageError && user?.avatar ? (
                    <Image
                      src={user.avatar}
                      alt="Profile"
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-lg object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <span className="text-white font-bold text-sm">{getInitials()}</span>
                  )}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-white">{getDisplayName()}</p>
                  <p className="text-xs text-gray-400">Portfolio Dashboard</p>
                </div>
              </div>
            </div>

            {/* Right — actions */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="hidden md:flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-transparent focus-within:border-cyan-500/40 transition-colors">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  className="bg-transparent text-white placeholder-gray-400 outline-none text-sm w-32"
                />
              </div>

              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5" />
                </motion.button>
                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-700">
                        <h3 className="text-white font-medium">Notifications</h3>
                      </div>
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <BellOff className="w-8 h-8 text-gray-600 mb-3" />
                        <p className="text-gray-400 text-sm">No notifications yet</p>
                        <p className="text-gray-600 text-xs mt-1">Price alerts and trade updates will appear here</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User Menu */}
              <div className="relative" ref={userMenuRef}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <motion.div
                    animate={{ rotate: userMenuOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </motion.button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-3 border-b border-gray-700">
                        <p className="text-white font-medium text-sm truncate">{getDisplayName()}</p>
                        <p className="text-gray-400 text-xs truncate">{user?.email}</p>
                      </div>
                      <div className="p-2">
                        <Link
                          href="/settings"
                          className="w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings className="w-4 h-4" />
                          <span className="text-sm">Settings</span>
                        </Link>
                        <button
                          onClick={() => { logout(); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm">Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={sidebarOpen ? "close" : "open"}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        {/* Desktop sidebar — always visible, no AnimatePresence needed */}
        <aside className="hidden lg:flex w-64 shrink-0 h-[calc(100vh-73px)] sticky top-0 bg-gray-900/90 backdrop-blur-xl border-r border-gray-800 flex-col overflow-y-auto">
          <div className="p-6 h-full flex flex-col">
            <nav className="space-y-1 flex-1">
              {navigationItems.map((item, i) => {
                const isActive = pathname === item.href;
                return (
                  <motion.div
                    key={item.name}
                    custom={i}
                    variants={navItemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <Link
                      href={item.href}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                        isActive
                          ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/20"
                          : item.highlight
                          ? "text-cyan-400 hover:text-white hover:bg-cyan-600/20 border border-cyan-500/20"
                          : "text-gray-400 hover:text-white hover:bg-gray-800"
                      }`}
                    >
                      <motion.div
                        whileHover={{ rotate: 8, scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        <item.icon className="w-5 h-5" />
                      </motion.div>
                      <span className="font-medium">{item.name}</span>
                      {item.highlight && !isActive && (
                        <span className="ml-auto text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-medium">
                          AI
                        </span>
                      )}
                      {isActive && (
                        <motion.div
                          layoutId="activeNavIndicator"
                          className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white"
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-500">© 2025 VaultX</p>
              <p className="text-xs text-gray-600 mt-1">Portfolio Manager v1.0</p>
            </div>
          </div>
        </aside>

        {/* Mobile sidebar — slides in from the left */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              variants={sidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed lg:hidden z-30 left-0 top-[73px] w-64 h-[calc(100vh-73px)] bg-gray-900/95 backdrop-blur-xl border-r border-gray-800 flex flex-col overflow-y-auto"
            >
              <div className="p-6 h-full flex flex-col">
                <nav className="space-y-1 flex-1">
                  {navigationItems.map((item, i) => {
                    const isActive = pathname === item.href;
                    return (
                      <motion.div
                        key={item.name}
                        custom={i}
                        variants={navItemVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <Link
                          href={item.href}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                            isActive
                              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/20"
                              : item.highlight
                              ? "text-cyan-400 hover:text-white hover:bg-cyan-600/20 border border-cyan-500/20"
                              : "text-gray-400 hover:text-white hover:bg-gray-800"
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.name}</span>
                          {item.highlight && !isActive && (
                            <span className="ml-auto text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-medium">AI</span>
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
                </nav>
                <div className="pt-4 border-t border-gray-800 text-center">
                  <p className="text-xs text-gray-500">© 2025 VaultX</p>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 relative z-10 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}