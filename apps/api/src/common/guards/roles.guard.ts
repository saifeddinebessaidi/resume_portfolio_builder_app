import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type UserRole } from "@repo/contracts";

import { ForbiddenError } from "../errors/errors";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { type RequestWithUser } from "./auth.guard";

/**
 * Layer 3 of the four authorization layers: role. Runs after AuthGuard, so `req.user` is the local
 * user whose role came from our database — not from a token claim.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();

    // No user here means the route is @Public() AND @Roles() — a contradiction worth failing on
    // rather than silently allowing.
    if (!req.user) throw new ForbiddenError();

    if (!required.includes(req.user.role)) throw new ForbiddenError();

    return true;
  }
}
