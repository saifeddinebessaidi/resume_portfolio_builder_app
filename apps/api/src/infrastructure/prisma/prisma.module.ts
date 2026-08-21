import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import { UnitOfWork } from "./unit-of-work";

/**
 * Global because there is exactly one client per process and several modules' repositories need
 * it. Only classes under `infrastructure/` may inject it — enforced by the zone rule in
 * eslint.config.mjs.
 */
@Global()
@Module({
  providers: [PrismaService, UnitOfWork],
  exports: [PrismaService, UnitOfWork],
})
export class PrismaModule {}
