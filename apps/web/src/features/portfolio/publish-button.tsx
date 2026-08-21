"use client";

import { type Publication } from "@repo/contracts";
import { Check, Copy, Globe } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages/fr";

/**
 * **Generate the portfolio's public link.**
 *
 * ## Why this is ours rather than ported
 *
 * The audited repository does not do this. `slug` appears in it eight times and every one is a read —
 * `where: { slug, status: 'published' }`, a `@Get(':slug')` param, a `select`, a type — and nothing ever
 * assigns it or sets `status: 'published'`. There is no `/p/[slug]` page either. So its public endpoint
 * could never return a row, and there was no link-generation code to port.
 *
 * Ours goes through `POST /projects/:id/publication`, built in phase 2 step 09, which is where the rules
 * that make a public link safe already live:
 *
 * - the **slug is generated server-side** from the title and deduplicated against a unique index, so two
 *   users publishing "Mon portfolio" cannot collide;
 * - it is checked against a **reserved list**, so a slug cannot shadow an app route;
 * - `expiresAt` comes from the plan's `HOSTING_DAYS`, and the **public read filters on it** — a cron that
 *   fails to run cannot leave expired hosting live;
 * - a custom slug requires the `CUSTOM_SLUG` entitlement.
 *
 * None of that is expressible client-side, which is why this component only asks and displays.
 *
 * ## Publication is paid, and a refusal is a normal outcome
 *
 * Creating and editing are free; delivery is what a customer pays for (ADR-0012). So `403` here is not an
 * error state to hide — it is the paywall doing its job, and it gets its own message pointing at the
 * offers rather than a generic failure.
 */
export function PublishButton({
  projectId,
  publicUrl,
}: {
  projectId: string;
  /** The link if this project is already published, from the server-rendered project. */
  publicUrl: string | null;
}): ReactNode {
  const [published, setPublished] = useState<Publication | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** The freshly-returned link wins over the server-rendered one, which is a render behind. */
  const url = published?.publicUrl ?? publicUrl;

  const publish = async (): Promise<void> => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/publication`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      });

      if (!response.ok) {
        const problem: unknown = await response.json().catch(() => null);
        const code =
          problem && typeof problem === "object" && "code" in problem ? String(problem.code) : "";
        const detail =
          problem && typeof problem === "object" && "detail" in problem
            ? String(problem.detail)
            : messages.errors.generic;

        /**
         * An entitlement refusal gets the upsell, anything else gets the API's own French detail —
         * which already embeds the real numbers ("1 publication sur 1").
         */
        setError(
          code === "NO_ACTIVE_SUBSCRIPTION" || code === "SUBSCRIPTION_EXPIRED"
            ? messages.portfolio.publishBlocked
            : detail,
        );
        return;
      }

      setPublished((await response.json()) as Publication);
    } catch {
      setError(messages.errors.generic);
    } finally {
      setPending(false);
    }
  };

  const copy = async (): Promise<void> => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Reverts on its own: a permanent "copié" stops meaning anything after the first click.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard denied — the link is visible and selectable, so there is nothing to report. */
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void publish()} disabled={pending}>
          <Globe aria-hidden className="size-4" />
          {pending
            ? messages.portfolio.publishing
            : url
              ? messages.portfolio.regenerateLink
              : messages.portfolio.generateLink}
        </Button>

        {url ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void copy()}>
            {copied ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            {copied ? messages.portfolio.linkCopied : messages.portfolio.copyLink}
          </Button>
        ) : null}
      </div>

      {url ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{messages.portfolio.linkReady}</p>
          {/* A real anchor: the point of a share link is that it opens. */}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm text-primary underline"
          >
            {url}
          </a>
          {published?.expiresAt ? (
            <Badge tone="info">
              {messages.portfolio.linkExpires}{" "}
              {new Intl.DateTimeFormat("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(published.expiresAt))}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
