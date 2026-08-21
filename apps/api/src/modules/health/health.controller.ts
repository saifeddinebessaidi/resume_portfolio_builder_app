import { Controller, Get, HttpStatus, ServiceUnavailableException } from "@nestjs/common";

import { AppConfigService } from "../../config/app-config.service";
import { Public } from "../../common/decorators/public.decorator";
import { HealthService, type HealthReport } from "./health.service";

/**
 * Excluded from the api/v1 prefix in main.ts so platform health checks have a stable path
 * that survives an API version bump.
 */
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthService,
    // Injected to prove constructor DI works end to end. If emitDecoratorMetadata were
    // misconfigured, this fails at boot with an unresolvable-dependency error — which is
    // the point of finding out here, with two files in play instead of forty.
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get()
  async check(): Promise<HealthReport & { environment: string }> {
    const report = await this.health.check();

    // Reports no version, no connection-string fragment and no dependency detail. A health
    // endpoint is public, and a public endpoint that enumerates your infrastructure is a
    // reconnaissance gift.
    const body = { ...report, environment: this.config.nodeEnv };

    if (!report.database) {
      throw new ServiceUnavailableException(body, {
        description: `database unreachable (${HttpStatus.SERVICE_UNAVAILABLE})`,
      });
    }

    return body;
  }
}
