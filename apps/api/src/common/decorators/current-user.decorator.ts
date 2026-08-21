import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import { type RequestWithUser } from "../guards/auth.guard";
import { type User } from "../../modules/users/domain/user.entity";

/**
 * Injects the **local** `User` — our id, our role, our status — never the raw token payload.
 *
 * That distinction is the point: a use case receives a domain entity whose `role` came from our
 * database, so nothing downstream can accidentally read an unvalidated claim.
 *
 * Non-null by construction: the global AuthGuard has already run and thrown for any route that
 * reaches a handler without a user. A route marked `@Public()` must not use this decorator.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest<RequestWithUser>();

  if (!req.user) {
    // A wiring bug, not a client error: @CurrentUser() on a @Public() route.
    throw new Error(
      "@CurrentUser() used on a route with no authenticated user. Remove @Public() or the decorator.",
    );
  }

  return req.user;
});
