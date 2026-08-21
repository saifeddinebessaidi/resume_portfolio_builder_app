import { Module } from "@nestjs/common";

import { PrismaUserRepository } from "../infrastructure/prisma-user.repository";
import { ProvisionUserUseCase } from "../application/provision-user.use-case";
import { USER_REPOSITORY } from "../domain/user.repository";
import { UsersController } from "./users.controller";

/**
 * Where dependency inversion is actually wired: the interface token from `domain/` is bound to the
 * Prisma class in `infrastructure/`. Swapping the implementation — for tests, or if Prisma were
 * replaced — is this one line.
 */
@Module({
  controllers: [UsersController],
  providers: [ProvisionUserUseCase, { provide: USER_REPOSITORY, useClass: PrismaUserRepository }],
  // ProvisionUserUseCase is exported because the global AuthGuard depends on it, and
  // USER_REPOSITORY because the admin and dashboard modules read users.
  exports: [ProvisionUserUseCase, USER_REPOSITORY],
})
export class UsersModule {}
