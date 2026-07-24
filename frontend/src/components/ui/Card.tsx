import { cn } from "@/lib/utils";

/**
 * The base surface: 1px border, token background, no glass or blur.
 *
 * Depth comes from the border and the --card/--background contrast rather than
 * from shadows or backdrop-filter. Blur in particular is expensive to composite
 * and, on a page of dense numbers, makes text noticeably softer.
 */
export function Card({
 className,
 interactive = false,
 ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
 return (
 <div
 className={cn(
 "bg-card text-card-foreground border-border rounded-lg border",
 interactive && "hover:border-ring/40 transition-colors duration-200",
 className,
 )}
 {...props}
 />
 );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
 return <div className={cn("flex flex-col gap-1.5 p-6 pb-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
 return (
 <h3
 className={cn("font-heading text-base leading-none font-semibold tracking-tight", className)}
 {...props}
 />
 );
}

export function CardDescription({
 className,
 ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
 return <p className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
 return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
 return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export default Card;
