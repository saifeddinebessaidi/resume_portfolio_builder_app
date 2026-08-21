import { cookies } from "next/headers";

/**
 * The session seam.
 *
 * **This is the file the Supabase switch touches, and nothing else.** Today the bearer token lives in
 * an httpOnly cookie that the dev sign-in route sets, because the API is running its `local` auth
 * provider. When Supabase is wired in, `getAccessToken` reads the Supabase session instead — every
 * caller (the API client, the app-shell guard, the server components) is unchanged.
 *
 * A cookie rather than localStorage, deliberately: a server component cannot read localStorage, so a
 * token stored there forces every fetch into the browser and gives up server-side rendering of the
 * dashboard. It is also the shape the cross-origin handoff from the landing page will need — see
 * phase 3 step 03 and ADR-0001.
 */
export const SESSION_COOKIE = "reacchy_session";

/** Server-side only. Returns null rather than throwing so a caller can redirect instead. */
export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function hasSession(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}
