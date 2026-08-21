import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { CancelStaleOrdersUseCase } from "../application/cancel-stale-orders.use-case";

/**
 * The scheduling shell. All of the behaviour is in the use case, which is what a test calls
 * directly — a job whose logic lives inside a `@Cron` method can only be tested by waiting.
 *
 * Lives in `presentation/` on purpose: "when does this run" is a delivery concern in exactly the
 * same way an HTTP route is, and `@nestjs/schedule` is a framework detail the use case must not
 * acquire.
 */
@Injectable()
export class StaleOrdersCron {
  private readonly logger = new Logger(StaleOrdersCron.name);

  constructor(private readonly sweep: CancelStaleOrdersUseCase) {}

  /**
   * 03:15 UTC. Off the hour deliberately: every scheduled job in every application defaults to
   * the top of the hour, and a database on a shared tier does not need this competing with them.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: "cancel-stale-orders" })
  async run(): Promise<void> {
    try {
      await this.sweep.execute();
    } catch (error) {
      // Swallowed after logging: an unhandled rejection inside a cron tick takes the process down
      // with it, and a housekeeping sweep failing is not a reason to stop serving requests. The
      // next night's run picks up whatever this one missed, because the query is time-based rather
      // than a queue that can be drained wrongly.
      this.logger.error(
        `Stale-order sweep failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
