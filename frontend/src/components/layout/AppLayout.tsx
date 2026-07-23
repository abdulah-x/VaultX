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
import ThemeToggle from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
 children: ReactNode;
}

// Navigation items — kept in sync with actual /app routes
const navigationItems = [
 { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
 { name: "Portfolio", href: "/portfolio", icon: PieChartIcon },
 { name: "Markets Overview", href: "/markets", icon: TrendingUp },
 { name: "Trade History", href: "/trades", icon: Activity },
 { name: "Analytics", href: "/analytics", icon: Target },
 { name: "AI Advisor", href: "/advisor", icon: Sparkles, highlight: true },
 { name: "Settings", href: "/settings", icon: Settings },
];

// Only the mobile drawer and the dropdowns animate. The header and the nav
// items used to run entrance animations on every page load, which meant the
// whole chrome re-animated each time someone clicked a link -- the opposite of
// the "instant and calm" rule the app is meant to follow.
const sidebarVariants = {
 open: { x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
 closed: { x: -280, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
};

const dropdownVariants = {
 hidden: { opacity: 0, scale: 0.95, y: -8 },
 visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" as const } },
 exit: { opacity: 0, scale: 0.95, y: -8, transition: { duration: 0.1 } },
};

/** Shared by the desktop rail and the mobile drawer, which previously held two
 * independent copies of this markup that had already drifted apart. */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
 const pathname = usePathname();

 return (
 <nav className="flex-1 space-y-1">
 {navigationItems.map((item) => {
 const isActive = pathname === item.href;
 return (
 <Link
 key={item.name}
 href={item.href}
 onClick={onNavigate}
 aria-current={isActive ? "page" : undefined}
 className={cn(
 "relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
 isActive
 ? "bg-primary text-primary-foreground"
 : item.highlight
 ? "text-primary hover:bg-accent"
 : "text-muted-foreground hover:text-foreground hover:bg-accent",
 )}
 >
 <item.icon className="h-5 w-5 shrink-0" />
 <span className="font-medium">{item.name}</span>
 {item.highlight && !isActive && (
 <span className="bg-primary/15 text-primary ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium">
 AI
 </span>
 )}
 </Link>
 );
 })}
 </nav>
 );
}

function SidebarFooter() {
 return (
 <div className="border-border border-t pt-4 text-center">
 <p className="text-muted-foreground text-xs">© 2025 VaultX</p>
 <p className="text-muted-foreground/70 mt-1 text-xs">Portfolio Manager v1.0</p>
 </div>
 );
}

export default function AppLayout({ children }: AppLayoutProps) {
 const [sidebarOpen, setSidebarOpen] = useState(false);
 const [imageError, setImageError] = useState(false);
 const [userMenuOpen, setUserMenuOpen] = useState(false);
 const [notificationsOpen, setNotificationsOpen] = useState(false);
 const { user, isLoading, logout } = useAuth();
 const userMenuRef = useRef<HTMLDivElement>(null);
 const notificationsRef = useRef<HTMLDivElement>(null);

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
 <div className="bg-background flex min-h-screen items-center justify-center">
 <div className="text-center">
 <div className="bg-primary text-primary-foreground mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl">
 <BarChart3 className="h-8 w-8 animate-pulse" />
 </div>
 <div className="text-foreground text-lg font-medium">Loading Portfolio…</div>
 <div className="text-muted-foreground mt-2 text-sm">
 Please wait while we prepare your dashboard
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="bg-background min-h-screen">
 {/* ── Header ──────────────────────────────────────────────────────── */}
 <header className="bg-background/80 border-border sticky top-0 z-30 border-b backdrop-blur-md">
 <div className="px-6 py-4">
 <div className="flex items-center justify-between">
 {/* Left — Logo + user */}
 <div className="flex items-center gap-6">
 <Link href="/dashboard" className="flex items-center gap-3">
 <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg">
 <BarChart3 className="h-5 w-5" />
 </div>
 <div className="hidden sm:block">
 <h1 className="font-heading text-foreground text-xl font-bold">VaultX</h1>
 <p className="text-muted-foreground text-xs tracking-wider">PORTFOLIO MANAGER</p>
 </div>
 </Link>

 <div className="flex items-center gap-3">
 <div className="bg-secondary border-border flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border">
 {!imageError && user?.avatar ? (
 <Image
 src={user.avatar}
 alt="Profile"
 width={36}
 height={36}
 className="h-9 w-9 rounded-md object-cover"
 onError={() => setImageError(true)}
 />
 ) : (
 <span className="text-secondary-foreground text-sm font-bold">
 {getInitials()}
 </span>
 )}
 </div>
 <div className="hidden sm:block">
 <p className="text-foreground text-sm font-semibold">{getDisplayName()}</p>
 <p className="text-muted-foreground text-xs">Portfolio Dashboard</p>
 </div>
 </div>
 </div>

 {/* Right — actions */}
 <div className="flex items-center gap-2">
 {/* Search */}
 <div className="bg-secondary focus-within:border-ring hidden items-center gap-2 rounded-md border border-transparent px-3 py-2 transition-colors md:flex">
 <Search className="text-muted-foreground h-4 w-4" />
 <input
 type="text"
 aria-label="Search assets"
 placeholder="Search assets…"
 className="text-foreground placeholder:text-muted-foreground w-32 bg-transparent text-sm outline-none"
 />
 </div>

 <ThemeToggle />

 {/* Notifications */}
 <div className="relative" ref={notificationsRef}>
 <button
 type="button"
 aria-label="Notifications"
 aria-expanded={notificationsOpen}
 onClick={() => setNotificationsOpen(!notificationsOpen)}
 className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-2 transition-colors active:scale-95"
 >
 <Bell className="h-5 w-5" />
 </button>
 <AnimatePresence>
 {notificationsOpen && (
 <motion.div
 variants={dropdownVariants}
 initial="hidden"
 animate="visible"
 exit="exit"
 className="bg-popover text-popover-foreground border-border absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border shadow-lg"
 >
 <div className="border-border border-b p-4">
 <h3 className="font-medium">Notifications</h3>
 </div>
 <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
 <BellOff className="text-muted-foreground mb-3 h-8 w-8" />
 <p className="text-muted-foreground text-sm">No notifications yet</p>
 <p className="text-muted-foreground/70 mt-1 text-xs">
 Price alerts and trade updates will appear here
 </p>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* User Menu */}
 <div className="relative" ref={userMenuRef}>
 <button
 type="button"
 aria-label="Account menu"
 aria-expanded={userMenuOpen}
 onClick={() => setUserMenuOpen(!userMenuOpen)}
 className="text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 rounded-md p-2 transition-colors active:scale-95"
 >
 <ChevronDown
 className={cn(
 "h-4 w-4 transition-transform duration-200",
 userMenuOpen && "rotate-180",
 )}
 />
 </button>
 <AnimatePresence>
 {userMenuOpen && (
 <motion.div
 variants={dropdownVariants}
 initial="hidden"
 animate="visible"
 exit="exit"
 className="bg-popover text-popover-foreground border-border absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border shadow-lg"
 >
 <div className="border-border border-b p-3">
 <p className="truncate text-sm font-medium">{getDisplayName()}</p>
 <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
 </div>
 <div className="p-2">
 <Link
 href="/settings"
 className="text-muted-foreground hover:text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors"
 onClick={() => setUserMenuOpen(false)}
 >
 <Settings className="h-4 w-4" />
 <span className="text-sm">Settings</span>
 </Link>
 <button
 onClick={() => { logout(); setUserMenuOpen(false); }}
 className="text-muted-foreground hover:text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors"
 >
 <LogOut className="h-4 w-4" />
 <span className="text-sm">Sign Out</span>
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* Mobile toggle */}
 <button
 type="button"
 aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
 aria-expanded={sidebarOpen}
 onClick={() => setSidebarOpen(!sidebarOpen)}
 className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-2 transition-colors active:scale-95 lg:hidden"
 >
 {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
 </button>
 </div>
 </div>
 </div>
 </header>

 <div className="flex min-h-[calc(100vh-73px)]">
 {/* Mobile overlay */}
 <AnimatePresence>
 {sidebarOpen && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="fixed inset-0 z-20 bg-black/50 lg:hidden"
 onClick={() => setSidebarOpen(false)}
 />
 )}
 </AnimatePresence>

 {/* ── Sidebar ─────────────────────────────────────────────────── */}
 <aside className="bg-card border-border sticky top-[73px] hidden h-[calc(100vh-73px)] w-64 shrink-0 flex-col overflow-y-auto border-r lg:flex">
 <div className="flex h-full flex-col p-6">
 <NavList />
 <SidebarFooter />
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
 className="bg-card border-border fixed top-[73px] left-0 z-30 flex h-[calc(100vh-73px)] w-64 flex-col overflow-y-auto border-r lg:hidden"
 >
 <div className="flex h-full flex-col p-6">
 <NavList onNavigate={() => setSidebarOpen(false)} />
 <SidebarFooter />
 </div>
 </motion.aside>
 )}
 </AnimatePresence>

 {/* ── Main content ─────────────────────────────────────────────── */}
 <main className="relative z-10 flex-1 overflow-auto">{children}</main>
 </div>
 </div>
 );
}
