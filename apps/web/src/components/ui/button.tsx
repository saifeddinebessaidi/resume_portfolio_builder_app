import { type VariantProps, cva } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The landing page's button, verbatim in shape: **pill radius (999px), gradient fill, lift on hover.**
 * `rc-btn` / `rc-btn-primary` / `rc-btn-ghost` are the reference project's own classes, copied into
 * globals.css — so a CTA here and a CTA on the marketing site are the same object.
 *
 * `disabled:` styling is part of the variant rather than left to callers: a quota-exhausted CTA is a
 * state this app renders constantly and it must read as deliberately unavailable, not broken.
 */
const buttonVariants = cva(
  "rc-btn disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "rc-btn-primary",
        ghost: "rc-btn-ghost",
        quiet: "text-muted-foreground hover:text-foreground",
      },
      size: {
        sm: "!px-4 !py-2 !text-xs",
        md: "",
        lg: "!px-8 !py-4 !text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps): ReactNode {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
