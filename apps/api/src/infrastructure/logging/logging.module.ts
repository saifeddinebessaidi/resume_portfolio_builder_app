import { type IncomingMessage, type ServerResponse } from "node:http";

import { Module } from "@nestjs/common";
import { LoggerModule, type Params } from "nestjs-pino";

import { AppConfigModule } from "../../config/config.module";
import { AppConfigService } from "../../config/app-config.service";
import { RequestContext } from "../../common/context/request-context";

/**
 * What must never reach a log file.
 *
 * `authorization` because a leaked access token sitting in log retention is a live credential.
 * `*.data` because `ProjectVersion.data` IS the user's CV — logging it would copy personal data
 * into a store with a completely different retention lifecycle from the database's.
 */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  "*.password",
  "*.token",
  "*.accessToken",
  "*.secret",
  "*.data",
  "req.body.data",
];

/**
 * Structured logging: JSON in production, human-readable locally.
 *
 * Every line carries `requestId` and `userId` from the AsyncLocalStorage context, so one grep on
 * a request id reconstructs the complete request — including lines emitted deep in a repository
 * that never saw the HTTP layer.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Params => ({
        pinoHttp: {
          level: config.logLevel,

          // Pretty locally; raw JSON in production so the platform's log ingest can parse it.
          ...(config.isProduction
            ? {}
            : {
                transport: {
                  target: "pino-pretty",
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: "HH:MM:ss.l",
                    ignore: "pid,hostname",
                  },
                },
              }),

          redact: { paths: REDACT_PATHS, censor: "[redacted]" },

          /** Correlates every line to the request context rather than to pino's own counter. */
          genReqId: () => RequestContext.requestId,

          customProps: () => {
            const { requestId, userId } = RequestContext.get();
            return { requestId, ...(userId ? { userId } : {}) };
          },

          // The default serialisers log entire request and response objects, which is noisy and
          // is how headers end up in logs by accident.
          serializers: {
            req: (req: IncomingMessage) => ({ method: req.method, url: req.url }),
            res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
          },

          // /health is polled by the platform every few seconds; logging it buries everything
          // else.
          autoLogging: {
            ignore: (req: IncomingMessage) => req.url === "/health",
          },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
