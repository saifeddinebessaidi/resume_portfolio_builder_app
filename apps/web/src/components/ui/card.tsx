import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The landing page's glass card: translucent gradient fill, 24px radius, 18px backdrop blur.
 *
 * `hoverable` is opt-in because the reference's lift-on-hover reads as "this is clickable". A data
 * table that floats when the mouse passes over it is noise; a category tile that does is an
 * affordance.
 */
export function Card({
  className,
  hoverable = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }): ReactNode {
  return <div className={cn("rc-glass", hoverable && "rc-glass-hover", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return <div className={cn("flex flex-col gap-2 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>): ReactNode {
  return <h3 className={cn("font-display text-lg leading-tight", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>): ReactNode {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return <div className={cn("flex items-center gap-2 p-6 pt-0", className)} {...props} />;
}
