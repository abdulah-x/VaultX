"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
 primary:
 "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring",
 secondary:
 "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring",
 outline:
 "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring",
 ghost:
 "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring",
 danger:
 "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
};

const SIZES: Record<Size, string> = {
 sm: "h-8 gap-1.5 px-3 text-xs",
 md: "h-10 gap-2 px-4 text-sm",
 lg: "h-12 gap-2 px-6 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: Variant;
 size?: Size;
 loading?: boolean;
}

/**
 * The press feedback is a CSS `active:scale-[0.98]`, not a motion component.
 * A transform on :active costs nothing, runs on the compositor, and cannot
 * desynchronise from the click the way a JS-driven spring can -- which matters
 * because buttons here submit trades.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
 { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
 ref,
) {
 return (
 <button
 ref={ref}
 disabled={disabled || loading}
 aria-busy={loading || undefined}
 className={cn(
 "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap",
 "transition-colors duration-150 active:scale-[0.98]",
 "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
 "disabled:pointer-events-none disabled:opacity-50",
 VARIANTS[variant],
 SIZES[size],
 className,
 )}
 {...props}
 >
 {loading && (
 <span
 aria-hidden
 className="border-current/30 h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-current"
 />
 )}
 {children}
 </button>
 );
});

export default Button;
