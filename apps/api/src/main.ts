import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_PREFIX } from "@repo/contracts";
import { Logger as PinoLogger } from "nestjs-pino";

import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { AppConfigService } from "./config/app-config.service";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // The API sits behind a platform proxy. Without this every client IP reads as the
      // proxy's, which would make the analytics ipHash a constant.
      trustProxy: true,
      // Seeds the request id that every log line carries.
      genReqId: () => randomUUID(),
      // A project payload is capped by the contract at 1MB; this is the transport-level
      // backstop, generous enough for the JSON envelope around it.
      bodyLimit: 2 * 1024 * 1024,
    }),
    // Nest's own startup logs go through pino too, so boot output has the same shape as
    // request output.
    { bufferLogs: true },
  );

  app.useLogger(app.get(PinoLogger));

  const config = app.get(AppConfigService);

  // /health stays outside the version prefix so a platform probe keeps working across an API
  // version bump.
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ""), { exclude: ["health"] });

  // Every non-2xx response in the application becomes RFC 7807 problem+json here, including
  // the ones Nest itself throws.
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // SIGTERM from the platform must close the Prisma pool, or Neon holds the connections until
  // they time out — which matters on a free tier with a low ceiling.
  app.enableShutdownHooks();

  await app.listen({ port: config.port, host: "0.0.0.0" });

  const logger = app.get(PinoLogger);
  logger.log(
    `API listening on port ${config.port} — env ${config.nodeEnv}, auth ${config.authProvider}`,
  );
}

void bootstrap();
