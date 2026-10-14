import { NextResponse } from "next/server";
import {
  ROUTES,
  authTokenResponseSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from "@repo/contracts";
import { z } from "zod";

import { SESSION_COOKIE } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * Sign-in / sign-up / sign-out for AUTH_PROVIDER=password.
 *
 * The browser posts credentials here, this handler forwards them to the API, and the token comes
 * back as an **httpOnly** cookie — no script ever sees it. On failure the API's problem body is
 * forwarded verbatim, so the form shows the API's French message.
 */
const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("signin") }).extend(signInRequestSchema.shape),
  z.object({ mode: z.literal("signup") }).extend(signUpRequestSchema.shape),
]);

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_FAILED", detail: "Vérifiez l'adresse e-mail et le mot de passe." },
      { status: 422 },
    );
  }

  const { mode, ...credentials } = parsed.data;
  const path = mode === "signup" ? ROUTES.auth.signUp() : ROUTES.auth.signIn();

  const upstream = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(credentials),
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  const token = authTokenResponseSchema.parse(await upstream.json());
  const result = NextResponse.json({ ok: true }, { status: mode === "signup" ? 201 : 200 });

  result.cookies.set(SESSION_COOKIE, token.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: token.expiresIn,
  });

  return result;
}

export function DELETE(): NextResponse {
  const result = NextResponse.json({ ok: true });
  result.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return result;
}
