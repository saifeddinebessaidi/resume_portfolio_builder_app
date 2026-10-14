import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import {
  type AuthTokenResponse,
  type SignInRequest,
  type SignUpRequest,
  signInRequestSchema,
  signUpRequestSchema,
} from "@repo/contracts";

import { AuthRateLimiter } from "./auth-rate-limiter";
import { PasswordAuthUseCase } from "../application/password-auth.use-case";
import { PasswordJwtVerifier } from "../../../infrastructure/auth/password-jwt.verifier";
import { Public } from "../../../common/decorators/public.decorator";
import { RateLimitedError } from "../../../common/errors/errors";
import { RequestContext } from "../../../common/context/request-context";
import { type User } from "../../users/domain/user.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

/** Mounted only when AUTH_PROVIDER=password (see AuthAccountsModule). */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: PasswordAuthUseCase,
    private readonly tokens: PasswordJwtVerifier,
    private readonly limiter: AuthRateLimiter,
  ) {}

  private throttle(action: string, email: string): string {
    const key = `${action}:${RequestContext.get().ip ?? "unknown"}:${email}`;
    const retryAfter = this.limiter.hit(key);
    if (retryAfter !== null) throw new RateLimitedError(retryAfter);
    return key;
  }

  private async tokenFor(user: User): Promise<AuthTokenResponse> {
    const { accessToken, expiresIn } = await this.tokens.issue({
      externalAuthId: user.externalAuthId,
      email: user.email,
    });
    return { accessToken, tokenType: "Bearer", expiresIn };
  }

  @Public()
  @Post("signup")
  @HttpCode(201)
  async signUp(
    @Body(zodPipe(signUpRequestSchema)) body: SignUpRequest,
  ): Promise<AuthTokenResponse> {
    this.throttle("signup", body.email);
    return this.tokenFor(await this.auth.signUp(body));
  }

  @Public()
  @Post("signin")
  @HttpCode(200)
  async signIn(
    @Body(zodPipe(signInRequestSchema)) body: SignInRequest,
  ): Promise<AuthTokenResponse> {
    const key = this.throttle("signin", body.email);
    const user = await this.auth.signIn(body);
    this.limiter.reset(key);
    return this.tokenFor(user);
  }
}
