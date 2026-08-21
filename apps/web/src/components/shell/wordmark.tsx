import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { messages } from "@/messages/fr";

/**
 * The landing page's wordmark, element for element: a gradient-filled rounded square holding a
 * Sparkles glyph, with a violet glow, then REACCHY in bold with 0.18em tracking.
 */
export function Wordmark(): ReactNode {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-flex size-8 items-center justify-center rounded-xl"
        style={{
          background: "var(--gradient-primary)",
          boxShadow: "0 6px 20px color-mix(in oklab, var(--accent) 45%, transparent)",
        }}
      >
        <Sparkles className="size-4 text-white" />
      </span>
      <span className="rc-wordmark text-xl">{messages.app.name}</span>
    </Link>
  );
}
