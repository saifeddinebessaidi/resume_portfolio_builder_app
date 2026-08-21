import { SetMetadata } from "@nestjs/common";
import { type EntitlementKey } from "@repo/contracts";

export const REQUIRE_ENTITLEMENT_KEY = "requireEntitlement";

export interface RequireEntitlementOptions {
  key: EntitlementKey;
  /**
   * Where the guard finds the category.
   *
   * `body` — the request carries `categoryCode` (create).
   * `project` — resolve it from the project named in the path (mutations to /projects/:id/*).
   */
  categoryFrom: "body" | "project";
}

/**
 * Declares which quota a route spends, so the guard can reject early with the right numbers.
 *
 * The guard is **not** the authority — see `entitlement.guard.ts`. This decorator buys a precise
 * error before any work is done, not the enforcement itself.
 */
export const RequireEntitlement = (options: RequireEntitlementOptions) =>
  SetMetadata(REQUIRE_ENTITLEMENT_KEY, options);
