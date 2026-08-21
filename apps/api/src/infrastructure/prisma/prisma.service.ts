import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { AppConfigService } from "../../config/app-config.service";

/** How long a liveness probe waits before calling the database unreachable. */
const PING_TIMEOUT_MS = 2_000;

/**
 * The single PrismaClient for the process.
 *
 * One instance, deliberately: Neon's free tier has a low connection ceiling and every
 * additional client opens its own pool. This is the only place `new PrismaClient()` is
 * called, and the only class allowed to hold it.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    super({
      // Query logging is opt-in behind LOG_LEVEL=trace, not on by default in development:
      // Prisma's query log echoes parameter values, and one of those parameters is
      // ProjectVersion.data — the user's CV. Off by default keeps user content out of logs;
      // trace is an explicit, deliberate choice when debugging a query.
      log: config.logLevel === "trace" ? ["query", "warn", "error"] : ["warn", "error"],
    });
  }

  async onModuleInit(): Promise<void> {
    // Connect eagerly so a bad connection string fails at boot rather than on the first
    // request. Neon's free tier also cold-starts, and paying that cost here keeps it out of
    // a user-facing request.
    await this.$connect();
    this.logger.log("Database connection established");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Liveness probe for /health. Bounded by a timeout because an unreachable Neon endpoint
   * hangs rather than refusing, and a health check that hangs is worse than one that fails:
   * the platform's own probe times out and the instance is killed with no diagnosis.
   */
  async ping(): Promise<{ ok: true } | { ok: false; reason: string }> {
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.$queryRaw`SELECT 1`,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`database did not respond within ${PING_TIMEOUT_MS}ms`)),
            PING_TIMEOUT_MS,
          );
        }),
      ]);
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown database error";
      // Logged in full here, and deliberately NOT returned to the caller: /health is public
      // and must not leak host names or connection details.
      this.logger.error(`Database ping failed: ${reason}`);
      return { ok: false, reason };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
