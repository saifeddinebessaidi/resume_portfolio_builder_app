import { type DynamicModule, Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthRateLimiter } from "./auth-rate-limiter";
import { CREDENTIALS_REPOSITORY, PASSWORD_HASHER } from "../domain/credentials";
import { PasswordAuthUseCase } from "../application/password-auth.use-case";
import { PrismaCredentialsRepository } from "../infrastructure/prisma-credentials.repository";
import { ScryptPasswordHasher } from "../infrastructure/scrypt-password-hasher";

/**
 * Sign-up and sign-in with email + password. Registered with routes only when
 * AUTH_PROVIDER=password: in the other modes the token would be unverifiable, so the endpoints
 * would hand out sessions that fail on the next request.
 */
@Module({})
export class AuthAccountsModule {
  static forProvider(provider: string): DynamicModule {
    if (provider !== "password") return { module: AuthAccountsModule };

    return {
      module: AuthAccountsModule,
      controllers: [AuthController],
      providers: [
        PasswordAuthUseCase,
        AuthRateLimiter,
        { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
        { provide: CREDENTIALS_REPOSITORY, useClass: PrismaCredentialsRepository },
      ],
    };
  }
}
