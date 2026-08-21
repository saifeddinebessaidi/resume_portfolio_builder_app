import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";

import { AppConfigService } from "../../config/app-config.service";
import { LocalJwtVerifier } from "../../infrastructure/auth/local-jwt.verifier";
import { Public } from "../../common/decorators/public.decorator";
import { zodPipe } from "../../common/pipes/zod-validation.pipe";

const issueTokenSchema = z
  .object({
    email: z.email(),
  })
  .strict();

type IssueTokenRequest = z.infer<typeof issueTokenSchema>;

/**
 * Mints a development bearer token so the whole API can be exercised before an identity provider
 * exists.
 *
 * **Only mounted when `AUTH_PROVIDER=local`** (see `dev-auth.module.ts`), and `env.schema.ts`
 * refuses to boot with that provider in production. Two independent guards, because an endpoint
 * that hands out tokens for any email address is the single worst thing that could reach
 * production by accident.
 *
 * The schema is declared here rather than in `@repo/contracts`: this is not part of the product's
 * API surface and must not appear in a shared package that phase 3 imports.
 */
@Controller("dev-auth")
export class DevAuthController {
  constructor(
    private readonly local: LocalJwtVerifier,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post("token")
  async token(
    @Body(zodPipe(issueTokenSchema)) body: IssueTokenRequest,
  ): Promise<{ accessToken: string; tokenType: "Bearer"; expiresIn: number; subject: string }> {
    // Defence in depth: the module is not registered in any other mode, but this makes the
    // refusal explicit at the point where the token would be created.
    if (this.config.authProvider !== "local") {
      throw new BadRequestException("Development token issuance is disabled.");
    }

    const { accessToken, expiresIn, subject } = await this.local.issue(body.email);
    return { accessToken, tokenType: "Bearer", expiresIn, subject };
  }
}
