import { type ZodType } from "zod";

import { ApiProblemError } from "./problem";
import { env } from "@/lib/env";

interface RequestOptions<T> {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** The response schema from `@repo/contracts`. Validated in development, trusted in production. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
}

/**
 * Reads the bearer token on whichever side of the render this is running.
 *
 * The dynamic import is **load-bearing**: a static import of the server module would pull
 * `next/headers` into the client bundle and fail the build. This is the standard shape for
 * isomorphic code in the App Router.
 */
async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    const { getAccessToken } = await import("@/lib/auth/session");
    return getAccessToken();
  }

  // In the browser the token is in an httpOnly cookie, which JavaScript cannot read by design.
  // Browser-side requests therefore rely on `credentials: "include"` and a same-site proxy route,
  // rather than attaching a header the client is not allowed to see.
  return null;
}

/**
 * One client, both sides of the render.
 *
 * Typed end to end by `@repo/contracts`, so this file contains **zero hand-written response types**:
 * every return type is inferred from the same declaration the API validates against. Renaming a field
 * is a compile error here, not a runtime surprise in a component.
 */
export async function request<T>(options: RequestOptions<T>): Promise<T> {
  const token = await getToken();

  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${options.path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    /**
     * Every response here is per-user. Next's default fetch caching would happily serve one user's
     * dashboard to another during SSR — a genuine and easily-missed data leak.
     */
    cache: "no-store",
    credentials: "include",
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) throw await ApiProblemError.fromResponse(response);

  // 204 No Content: there is no body to parse.
  if (response.status === 204) return undefined as T;

  const json: unknown = await response.json();

  /**
   * **Validate in development, trust in production.**
   *
   * Parsing every response costs measurable CPU on the hot path, and its value is catching contract
   * drift — which happens while developing, not in production against an API built from the same
   * schemas.
   */
  if (process.env.NODE_ENV !== "production" && options.schema) {
    return options.schema.parse(json);
  }

  return json as T;
}
