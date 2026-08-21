import { SetMetadata } from "@nestjs/common";
import { type UserRole } from "@repo/contracts";

export const ROLES_KEY = "roles";

/**
 * Restricts a route to the listed roles. Applied with `RolesGuard` at the controller level rather
 * than globally, because only `/admin/**` needs it and a global roles guard would have to
 * special-case every other route.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
