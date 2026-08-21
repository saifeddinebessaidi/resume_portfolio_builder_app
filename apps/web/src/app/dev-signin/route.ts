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
 *
 * ## The staging escape hatch, and why it is shaped like this
 *
 * Vercel **always** runs Next.js with `NODE_ENV=production` — it is what enables React's production
 * build and it is not meaningfully overridable. So the guard above, written for "never ship this live",
 * also made the deployed staging site impossible to sign into: the form posted, got a 404, and showed
 * "Une erreur est survenue."
 *
 * `ALLOW_DEV_SIGNIN=true` opts back in. Deliberately an **opt-in flag rather than a relaxed condition**:
 * the default is still refusal, so a forgotten deploy stays safe, and turning it on is a decision
 * someone made by name in a dashboard rather than a side effect of how the app was built.
 *
 * **What it costs, stated plainly:** with the flag on, anyone who reaches this URL can sign in as any
 * email that exists — including an ADMIN — with no password. It is an open door. Acceptable only on a
 * URL that has not been shared, and it must come off before launch. The real fix is the Supabase
 * sign-in this route is a placeholder for; when that lands, this file is deleted and the flag with it.
 */
const bodySchema = z.object({ email: z.email() });

export async function POST(request: Request): Promise<NextResponse> {
  /**
   * Read **inside the handler**, not at module scope.
   *
   * A module-scope `const` is evaluated once when the serverless function cold-starts, and on Vercel
   * that evaluation can happen during the build's page-data collection — where the runtime variable is
   * not necessarily present. Reading it per request removes the question entirely, and costs nothing.
   */
  const flag = process.env.ALLOW_DEV_SIGNIN;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && flag !== "true") {
    /**
     * The refusal **says which condition failed**, because the previous version could not.
     *
     * "Disabled in production." was returned both when the flag was unset *and* when a stale deployment
     * was still running the old code — indistinguishable from outside, which turned a one-line
     * configuration problem into guesswork. `flag` is echoed as `null` / `"set-but-not-true"` rather
     * than verbatim so a value is never reflected back.
     *
     * Safe to expose: this route is a development placeholder, and knowing that a feature flag is off
     * tells an attacker nothing they could not learn by trying.
     */
    return NextResponse.json(
      {
        error: "Disabled in production.",
        reason: "ALLOW_DEV_SIGNIN is not enabled on this deployment.",
        allowDevSignin: flag === undefined ? null : "set-but-not-true",
        hint: "Set ALLOW_DEV_SIGNIN=true in the Vercel project and REDEPLOY — env changes do not apply to an existing deployment.",
      },
      { status: 404 },
    );
  }

  if (isProduction) {
    // Logged on every use, so an accidentally-live staging flag is visible in the runtime logs
    // rather than silent.
    console.warn(
      "[dev-signin] ALLOW_DEV_SIGNIN is enabled in a production build. " +
        "Passwordless sign-in is OPEN on this deployment. Remove the flag before launch.",
    );
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
     * Now conditional, and it has to be.
     *
     * This was a hard `false` with a comment arguing the production branch was unreachable — true
     * while the guard above returned unconditionally in production, and **false the moment
     * `ALLOW_DEV_SIGNIN` made a production build reachable**. A bearer token sent without `Secure`
     * over a deployed site is a token that will travel over plain http if anything ever downgrades
     * the connection.
     *
     * Local development is plain http, so `false` there — a `Secure` cookie is simply dropped on
     * `http://localhost` and sign-in would break with no visible reason.
     */
    secure: isProduction,
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
