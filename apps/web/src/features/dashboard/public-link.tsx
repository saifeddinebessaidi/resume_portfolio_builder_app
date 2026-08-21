"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";

import { messages } from "@/messages/fr";

/**
 * A published project's public link, in a list row: **open it, or copy it.**
 *
 * The generated link only existed inside the editor, on the component that had just created it — so once
 * you left the page there was no way back to it short of publishing again. A share link whose only home is
 * the screen that minted it is not a share link.
 *
 * ## Why both actions
 *
 * The anchor is for *checking* — "does my portfolio look right" — and it opens in a new tab so the
 * dashboard survives. The copy button is for the actual job, which is pasting the URL into a DM or an
 * Instagram bio; that is what the link is *for*, and asking someone to select truncated text in a table
 * cell to get it is worse than useless on a phone.
 *
 * ## Truncated display, whole URL copied
 *
 * The visible text drops the scheme and is clipped by its container. The clipboard gets `url` verbatim —
 * copying what is *rendered* would hand over a broken address, which is the kind of bug that is invisible
 * until someone else's tap 404s.
 *
 * A client component only because the clipboard is a browser API. Everything around it in these tables
 * stays server-rendered.
 */
export function PublicLink({ url }: { url: string }): ReactNode {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Reverts on its own — a permanent "copié" stops meaning anything after the first click.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Denied or unavailable (an insecure origin). The link is still visible and openable. */
    }
  };

  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={url}
        className="inline-flex min-w-0 items-center gap-1 text-xs text-primary hover:underline"
      >
        <ExternalLink aria-hidden className="size-3 shrink-0" />
        <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
      </a>

      <button
        type="button"
        onClick={() => void copy()}
        title={copied ? messages.portfolio.linkCopied : messages.portfolio.copyLink}
        aria-label={copied ? messages.portfolio.linkCopied : messages.portfolio.copyLink}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)] hover:text-foreground"
      >
        {copied ? (
          <Check aria-hidden className="size-3.5 text-[var(--success,var(--primary))]" />
        ) : (
          <Copy aria-hidden className="size-3.5" />
        )}
      </button>
    </span>
  );
}
