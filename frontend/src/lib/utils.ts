import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * Plain string concatenation loses that: `"p-2" + " p-4"` emits both and the
 * winner is whichever CSS rule the stylesheet happens to order last, not the
 * one the caller passed. twMerge resolves conflicts by utility group, which is
 * what makes a `className` prop able to override a component's own defaults.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
