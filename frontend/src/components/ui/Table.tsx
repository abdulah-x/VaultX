import { cn } from "@/lib/utils";

/**
 * Deliberately unanimated. Holdings tables re-sort and re-render on every price
 * tick; sliding or fading rows on that cadence makes a figure unreadable at the
 * moment someone is trying to read it.
 *
 * The wrapper scrolls horizontally on its own so a wide table never forces the
 * page body to scroll sideways.
 */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
 return (
 <div className="w-full overflow-x-auto">
 <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
 </div>
 );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
 return <thead className={cn("[&_tr]:border-border [&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
 return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
 return (
 <tr
 className={cn("border-border hover:bg-accent/50 border-b transition-colors", className)}
 {...props}
 />
 );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
 return (
 <th
 className={cn(
 "text-muted-foreground h-10 px-4 text-left align-middle text-xs font-medium tracking-wide uppercase",
 className,
 )}
 {...props}
 />
 );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
 return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

/** Monospace cell for figures, so digits align down the column. */
export function TableNumericCell({
 className,
 ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
 return <TableCell className={cn("font-mono tabular-nums", className)} {...props} />;
}

export default Table;
