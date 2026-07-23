"use client";

import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

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
 /** Retained so existing call sites keep compiling; no longer staggers an entrance. */
 index?: number;
}

/**
 * The figure itself is static.
 *
 * This previously animated its scale on mount and re-ran on every value change,
 * so a live-updating balance pulsed continuously -- exactly the behaviour the
 * dashboard motion rule excludes. The value is the reason the card exists; it
 * should be readable the instant it renders.
 */
export default function MetricCard({
 title,
 value,
 change,
 subtitle,
 icon,
 className = "",
}: MetricCardProps) {
 return (
 <Card interactive className={cn("p-6", className)}>
 <div className="mb-6 flex items-center gap-3">
 {icon && (
 <div className="bg-accent text-accent-foreground flex h-10 w-10 items-center justify-center rounded-md">
 {icon}
 </div>
 )}
 <h3 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
 {title}
 </h3>
 </div>

 <div className="mb-4">
 <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">{value}</div>
 {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
 </div>

 {change && (
 <div className="flex items-center gap-2">
 <span
 className={cn(
 "font-mono text-sm font-medium tabular-nums",
 change.isPositive ? "text-vaultx-success" : "text-vaultx-danger",
 )}
 >
 {change.value}
 </span>
 {change.percentage && (
 <Badge variant={change.isPositive ? "success" : "danger"}>{change.percentage}</Badge>
 )}
 </div>
 )}
 </Card>
 );
}
