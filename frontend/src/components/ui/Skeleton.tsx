import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Pulses rather than sweeps -- a shimmer gradient on a
 * grid of these reads as motion across the whole page.
 */
export default function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
