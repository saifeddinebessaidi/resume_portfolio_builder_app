import { z } from "zod";

/**
 * The three things a user can buy and build.
 *
 * Declared as a `const` object rather than a TypeScript `enum` so the values are plain
 * strings at runtime and the type is a union — which is what makes `switch (code)`
 * exhaustiveness-checked and what lets the browser tree-shake this file.
 *
 * This is duplicated in the Prisma schema by necessity: Prisma generates its own enums and
 * apps/web must never import `@prisma/client`. A phase 9 test asserts parity between the two,
 * so adding a Prisma value without updating this file fails the suite rather than production.
 */
export const CategoryCode = {
  RESUME: "RESUME",
  PORTFOLIO: "PORTFOLIO",
  PORTFOLIO_PRO: "PORTFOLIO_PRO",
} as const;

export type CategoryCode = (typeof CategoryCode)[keyof typeof CategoryCode];

export const categoryCodeSchema = z.enum(CategoryCode);

/** Iteration order for the dashboard's three tables. The seed's `sortOrder` mirrors this. */
export const CATEGORY_CODES = [
  CategoryCode.RESUME,
  CategoryCode.PORTFOLIO,
  CategoryCode.PORTFOLIO_PRO,
] as const;

/**
 * URL segment per category. Kept here rather than read from the database because the web
 * app's route files are static and must match at build time.
 */
export const CATEGORY_SLUGS = {
  RESUME: "resume",
  PORTFOLIO: "portfolio",
  PORTFOLIO_PRO: "portfolio-pro",
} as const satisfies Record<CategoryCode, string>;
