import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { type ErrorCode, type Problem, problemTypeFor } from "@repo/contracts";
import { type FastifyReply } from "fastify";

import {
  isPrismaKnownError,
  mapPrismaError,
} from "../../infrastructure/prisma/prisma-error.mapper";
import { RequestContext } from "../context/request-context";
import { definitionFor } from "../errors/error-catalogue";
import { isDomainError } from "../errors/domain-error";

/** What a client is told when the failure is ours. Never the internal message. */
const GENERIC_DETAIL = "Une erreur interne est survenue. Veuillez réessayer.";

/**
 * Turns everything thrown anywhere in the application into RFC 7807 `application/problem+json`.
 *
 * Four ordered branches — domain error, Prisma error, HttpException, unknown — because each
 * carries a different amount of trustworthy information, and the last one carries none.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const { requestId } = RequestContext.get();

    // Read the URL from the request, not from the context: Nest rewrites `req.url` relative to
    // the mount point for middleware registered under a global prefix, so the context's `path`
    // is "/" for every prefixed route. Fastify's own request object keeps the full URL.
    const request = http.getRequest<{ originalUrl?: string; url?: string }>();
    const problem = this.toProblem(exception, requestId, request.originalUrl ?? request.url ?? "");

    if (problem.status >= 500) {
      // The full error, including any Prisma message, is logged here and only here.
      this.logger.error(
        { err: exception, requestId, code: problem.code },
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
      );
    } else {
      this.logger.warn(
        { requestId, code: problem.code, status: problem.status },
        `Request rejected: ${problem.code}`,
      );
    }

    void reply.status(problem.status).type("application/problem+json").send(problem);
  }

  private toProblem(exception: unknown, requestId: string, instance: string): Problem {
    // 1. A business fact thrown by a use case. Fully trusted: the code, the detail and the meta
    //    were all written to be shown.
    if (isDomainError(exception)) {
      return this.build(exception.code, exception.message, instance, requestId, exception.meta);
    }

    // 2. Prisma. Translated by infrastructure/, which is the only layer that knows what a
    //    Prisma error code means. The raw message is never forwarded — it can contain column
    //    names, constraint names and occasionally values.
    if (isPrismaKnownError(exception)) {
      const mapped = mapPrismaError(exception);
      return this.build(
        mapped.code,
        mapped.detail ?? GENERIC_DETAIL,
        instance,
        requestId,
        mapped.meta,
      );
    }

    // 3. Nest's own exceptions: a 404 from the router, a 401 from a guard, a 503 from /health.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = this.codeForStatus(status);
      const response = exception.getResponse();

      const detail =
        status >= 500
          ? GENERIC_DETAIL
          : typeof response === "string"
            ? response
            : (this.detailFromHttpResponse(response) ?? exception.message);

      return this.build(code, detail, instance, requestId, undefined, status);
    }

    // 4. Anything else. Nothing about it is safe to return.
    return this.build("INTERNAL_ERROR", GENERIC_DETAIL, instance, requestId);
  }

  private codeForStatus(status: number): ErrorCode {
    if (status === 401) return "UNAUTHENTICATED";
    if (status === 403) return "FORBIDDEN";
    if (status === 404) return "NOT_FOUND";
    if (status === 429) return "RATE_LIMITED";
    if (status >= 500) return "INTERNAL_ERROR";
    return "VALIDATION_FAILED";
  }

  private detailFromHttpResponse(response: object): string | undefined {
    const message: unknown = (response as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) {
      return message.filter((m): m is string => typeof m === "string").join(", ");
    }
    return undefined;
  }

  private build(
    code: ErrorCode,
    detail: string,
    instance: string,
    requestId: string,
    meta?: Record<string, unknown>,
    statusOverride?: number,
  ): Problem {
    const definition = definitionFor(code);

    return {
      type: problemTypeFor(code),
      title: definition.title,
      status: statusOverride ?? definition.httpStatus,
      code,
      detail,
      instance,
      requestId,
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
    };
  }
}
