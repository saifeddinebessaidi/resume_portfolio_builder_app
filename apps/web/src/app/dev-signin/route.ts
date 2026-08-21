import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * Development sign-in. Exchanges an email for a bearer token via the API's `local` auth provider and
 * stores it in an httpOnly cookie.
 *
 * **This exists only because Supabase is not wired in yet.** It is the mirror of the API's
 * `/dev-auth/token`, which the API mounts only when `AUTH_PROVIDER=local` and refuses to run in
 * production at all. When Supabase arrives, this route is deleted and `lib/auth/session.ts` reads the
 * Supabase session instead — no screen changes, because nothing above the session seam knows how the
 * token was obtained.
 *
 * Guarded the same way: it refuses outright in a production build, so it cannot ship live even if the
 * file is forgotten.
 */
const bodySchema = z.object({ email: z.email() });

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production." }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 422 });
  }

  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/dev-auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: parsed.data.email }),
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "The API refused to issue a development token." },
      { status: response.status },
    );
  }

  const { accessToken, expiresIn } = (await response.json()) as {
    accessToken: string;
    expiresIn: number;
  };

  const result = NextResponse.json({ ok: true });

  result.cookies.set(SESSION_COOKIE, accessToken, {
    // httpOnly so no script can read the token, which is the point of using a cookie over
    // localStorage — see the note in lib/auth/session.ts.
    httpOnly: true,
    sameSite: "lax",
    /**
     * `false`, and TypeScript proves why: the guard above already returned in production, so
     * `NODE_ENV === "production"` is unreachable here and a conditional flag would be dead code.
     * Local development is plain http. The real session cookie (phase 3 step 03, Supabase) is set
     * elsewhere and *is* `secure`.
     */
    secure: false,
    path: "/",
    maxAge: expiresIn,
  });

  return result;
}

// Not async: clearing a cookie is synchronous, and Next accepts a sync route handler.
export function DELETE(): NextResponse {
  const result = NextResponse.json({ ok: true });
  result.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return result;
}
