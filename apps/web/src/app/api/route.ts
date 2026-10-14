import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/auth/session";

/**
 * One proxy for every admin mutation, rather than one route file per endpoint.
 *
 * Safe to keep generic because it adds no authority of its own: it forwards the caller's own session
 * token to `/admin/*` only, and the API's `RolesGuard` decides. A non-admin reaching this gets the
 * API's 403, verbatim. Bodies are validated by the API's Zod pipes, so they are not re-parsed here.
 */
const SEGMENT = /^[A-Za-z0-9_-]+$/;

async function forward(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;

  // No `..`, no encoded slashes: the path can only ever name something under /admin.
  if (path.length === 0 || !path.every((segment) => SEGMENT.test(segment))) {
    return NextResponse.json({ code: "NOT_FOUND", detail: "Introuvable." }, { status: 404 });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", detail: "Session expirée." },
      { status: 401 },
    );
  }

  const body = request.method === "GET" ? undefined : await request.text();

  const upstream = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/${path.join("/")}`, {
    method: request.method,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    ...(body ? { body } : {}),
    cache: "no-store",
  });

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export { forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
