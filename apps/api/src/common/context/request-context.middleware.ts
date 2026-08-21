import { type IncomingMessage } from "node:http";

import { Injectable, type NestMiddleware } from "@nestjs/common";

import { RequestContext, type RequestStore } from "./request-context";

/**
 * Fastify's raw request, plus the id `genReqId` attaches to it. Middleware receives the raw
 * Node request rather than Fastify's wrapper, so this is the honest shape rather than a cast to
 * `FastifyRequest`.
 */
type RawRequest = IncomingMessage & { id?: string };

const firstHeader = (req: IncomingMessage, name: string): string | undefined => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * Opens the AsyncLocalStorage scope for the request.
 *
 * Registered as middleware, not an interceptor, because middleware runs before guards, pipes
 * and interceptors — the only position from which `requestId` is available to everything that
 * might log or throw. An interceptor would be too late: a guard rejecting a request would log
 * without a request id.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RawRequest, _res: unknown, next: () => void): void {
    const store: RequestStore = { requestId: req.id ?? "-" };

    // Assigned conditionally rather than spread, because `exactOptionalPropertyTypes` treats
    // "absent" and "present but undefined" as different — and an `ip: undefined` key would
    // read as "we looked and there was no IP" rather than "not applicable here".
    const forwarded = firstHeader(req, "x-forwarded-for")?.split(",")[0]?.trim();
    // trustProxy is enabled on the adapter, but that applies to Fastify's wrapper; middleware
    // sees the raw request, so the forwarded header is read explicitly here.
    const ip = forwarded ?? req.socket.remoteAddress;
    if (ip) store.ip = ip;

    const userAgent = firstHeader(req, "user-agent");
    if (userAgent) store.userAgent = userAgent;

    if (req.method) store.method = req.method;
    if (req.url) store.path = req.url;

    RequestContext.run(store, next);
  }
}
