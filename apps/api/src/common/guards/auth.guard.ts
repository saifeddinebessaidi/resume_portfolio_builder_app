import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AccountSuspendedError, UnauthenticatedError } from "../errors/errors";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ProvisionUserUseCase } from "../../modules/users/application/provision-user.use-case";
import { RequestContext } from "../context/request-context";
import { TOKEN_VERIFIER, type TokenVerifier } from "../../infrastructure/auth/token-verifier";
import { type User } from "../../modules/users/domain/user.entity";

/** What the guard attaches to the request for `@CurrentUser()` to read. */
export interface RequestWithUser {
  user?: User;
  headers: Record<string, string | string[] | undefined>;
}

function extractBearer(req: RequestWithUser): string | null {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;

  const [scheme, token] = value.split(" ");
  // Case-insensitive because "bearer" appears in the wild, and a working client should not fail
  // on capitalisation.
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token.trim() || null;
}

/**
 * The global authentication guard.
 *
 * Registered globally, so authentication is **opt-out** via `@Public()` rather than opt-in. A route
 * whose author forgot to think about auth returns 401 — which is the safe direction for that
 * mistake to fail in. The inverse (opt-in) means a forgotten decorator silently exposes data.
 *
 * It depends on `TokenVerifier`, the port — not on Supabase, not on jose. Which adapter is bound is
 * decided in `auth.module.ts` from configuration, so this file is identical whether the project is
 * running against the local development provider or Supabase.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly provisionUser: ProvisionUserUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();

    const token = extractBearer(req);
    if (!token) throw new UnauthenticatedError();

    // Throws TokenInvalidError, whose `detail` is deliberately generic: telling a caller whether a
    // token failed on its signature, its issuer or its expiry is an oracle for anyone probing.
    const identity = await this.verifier.verify(token);

    const user = await this.provisionUser.execute(identity);

    // Checked here, before any module sees the request, so a suspension cannot be missed by a
    // controller that forgot to look.
    if (user.status === "SUSPENDED") throw new AccountSuspendedError();

    req.user = user;

    // From this point every log line and analytics row carries the user id, without any function
    // signature having to accept it.
    RequestContext.setUserId(user.id);

    return true;
  }
}
