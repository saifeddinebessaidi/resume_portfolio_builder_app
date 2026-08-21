import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Navbar } from "@/components/shell/navbar";
import { getAccessToken } from "@/lib/auth/session";
import { meApi } from "@/lib/api/endpoints";
import { isUnauthenticated } from "@/lib/api/problem";

/**
 * The authenticated area's guard and shell.
 *
 * The check is a **real request to `/me`**, not merely "is there a cookie": a cookie can hold an
 * expired or revoked token, and letting that through would render the shell and then fail every
 * child request with a 401 the user cannot act on. One round trip here turns that into a clean
 * redirect.
 *
 * There is no login screen in this app. An unauthenticated visitor goes back to the landing page,
 * whose URL is configuration rather than a hardcoded string — see ADR-0001 and phase 3 step 03.
 */
export default async function AppLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const token = await getAccessToken();
  if (!token) redirect("/signin");

  let email: string;
  try {
    const me = await meApi.get();
    email = me.email;
  } catch (error) {
    if (isUnauthenticated(error)) redirect("/signin");
    // Anything else — the API is down, the database is unreachable — is not an auth problem, and
    // bouncing the user to a login screen would be a misleading diagnosis. Let the error boundary
    // show it instead.
    throw error;
  }

  return (
    // The landing page's aurora radials plus its film grain, so the dashboard sits on the same
    // surface as the marketing site rather than on a flat panel.
    <div className="rc-aurora rc-noise min-h-screen">
      <Navbar email={email} />
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10 md:px-10">{children}</main>
    </div>
  );
}
