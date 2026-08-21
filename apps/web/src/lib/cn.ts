import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, letting a later Tailwind utility win over an earlier conflicting one —
 * so `cn("p-2", condition && "p-4")` yields `p-4` rather than both.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
