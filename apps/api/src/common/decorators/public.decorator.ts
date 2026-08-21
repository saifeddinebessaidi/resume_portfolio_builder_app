import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route as reachable without a bearer token.
 *
 * Declared before the global auth guard exists (phase 2 step 06) on purpose: authentication
 * is opt-OUT, not opt-in. When the guard is added, every route that forgot to declare
 * itself starts returning 401 — which is the safe direction for that mistake to fail in.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
