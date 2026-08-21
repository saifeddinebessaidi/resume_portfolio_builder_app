import { type VariantProps, cva } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Pill status chip, on the dark palette.
 *
 * The tones are load-bearing for quota: "1 restant" (warning) and "0 restant" (danger) have to be
 * distinguishable at a glance, because that difference is the moment a user decides to renew. Colours
 * are mixed from the brand tokens rather than picked fresh, so nothing drifts from the landing page.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral:
          "border-border bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] text-muted-foreground",
        info: "border-[color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color-mix(in_oklab,var(--primary)_16%,transparent)] text-foreground",
        success:
          "border-[color-mix(in_oklab,var(--cyan)_45%,transparent)] bg-[color-mix(in_oklab,var(--cyan)_16%,transparent)] text-foreground",
        warning:
          "border-[color-mix(in_oklab,var(--accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-foreground",
        danger:
          "border-[color-mix(in_oklab,var(--destructive)_50%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_16%,transparent)] text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps): ReactNode {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
