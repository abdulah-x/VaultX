import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "danger" | "warning" | "outline";

const VARIANTS: Record<Variant, string> = {
  default: "bg-secondary text-secondary-foreground",
  // Gains and losses are tinted rather than solid so a dense table of them
  // does not read as a wall of colour.
  success: "bg-vaultx-success/15 text-vaultx-success",
  danger: "bg-vaultx-danger/15 text-vaultx-danger",
  warning: "bg-vaultx-warning/15 text-vaultx-warning",
  outline: "border-border text-muted-foreground border",
};

export default function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
