"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Opens the print dialog once the page is laid out and its fonts are ready.
 *
 * `document.fonts.ready` is the load-bearing part: printing before the webfont has swapped in produces
 * a PDF measured with the fallback face, which shifts every line and can push a resume onto a second
 * page. The builder's Playwright service awaited the same signal for the same reason.
 */
export function PrintTrigger(): ReactNode {
  useEffect(() => {
    let cancelled = false;

    const print = async () => {
      try {
        await document.fonts.ready;
      } catch {
        // A browser without the Font Loading API still prints; it just may use a fallback face.
      }
      // One frame after fonts settle, so layout has definitely flushed.
      requestAnimationFrame(() => {
        if (!cancelled) window.print();
      });
    };

    void print();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
