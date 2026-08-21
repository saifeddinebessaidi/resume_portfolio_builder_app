"use client";

import { useEffect, useRef } from "react";

/**
 * Records one view of a public page.
 *
 * Fired from the browser rather than the server render so the count means "a person opened this",
 * not "something fetched the HTML" — a prefetch, a crawler or an RSC revalidation would all inflate a
 * server-side counter.
 *
 * Goes straight to the API: this endpoint is `@Public()` and body-less, so there is no token to attach
 * and nothing for a proxy route to add. Everything recorded — IP (hashed with `APP_IP_SALT`), user
 * agent, timestamp — is derived server-side, which is why a caller cannot poison the count with
 * fabricated origins.
 *
 * Failures are swallowed. Analytics must never break the page it is measuring.
 */
export function RecordView({ slug }: { slug: string }): null {
  // Strict Mode double-invokes effects in development; without this the local count moves in twos.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const url = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/public/publications/${encodeURIComponent(slug)}/views`;

    // keepalive so the request survives the visitor navigating away immediately.
    void fetch(url, { method: "POST", keepalive: true }).catch(() => {
      /* Nothing to report to a visitor: the page is what they came for. */
    });
  }, [slug]);

  return null;
}
