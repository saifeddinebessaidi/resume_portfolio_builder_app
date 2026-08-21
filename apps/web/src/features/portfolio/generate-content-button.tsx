"use client";

import {
  portfolioGenerationReadiness,
  type GeneratedPortfolioContent,
  type PortfolioPayload,
} from "@repo/contracts";
import { Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages/fr";

/**
 * Writes the four copy fields with the AI, from the facts already in the form.
 *
 * ## Disabled until there is something true to write from
 *
 * The rule is `portfolioGenerationReadiness` in `@repo/contracts` — a name plus at least one of
 * {description, experiences, skills, socials} — and it is the **same function the endpoint calls**. A
 * client-only check would be a suggestion (`curl` ignores it) and a server-only check would leave the
 * button enabled until it failed. Both read one implementation.
 *
 * The bar is deliberately low: it is not a quality gate, it is the line between writing about someone and
 * inventing them. Given only "Célia, mannequin", a model produces a fluent, specific, entirely fabricated
 * biography — worse than an empty field, because it looks finished. The disabled state says which sections
 * are still empty rather than just refusing.
 *
 * ## Confirmed before it overwrites
 *
 * Unlike the résumé's summary this is **not** once-per-project — regenerating is a normal thing to want
 * after adding a credit. But it replaces four fields at once, so when any of them already has content the
 * press asks first. A destructive action that is cheap to repeat still needs to be deliberate.
 *
 * ## Fills the form, saves nothing
 *
 * `onGenerated` hands the text to the editor's draft state; the existing autosave-on-blur persists it. So
 * a generation costs no revision, and one the user dislikes is discarded by not saving — which is why the
 * endpoint returns text instead of writing it.
 */
export function GenerateContentButton({
  projectId,
  value,
  onGenerated,
  saveFirst,
}: {
  projectId: string;
  value: PortfolioPayload;
  onGenerated: (content: GeneratedPortfolioContent) => void;
  /**
   * **Awaited before the request goes out**, and load-bearing.
   *
   * The endpoint generates from the payload the server has *stored*, so anything typed and not yet saved
   * is invisible to it. Autosave-on-blur does fire when this button takes focus — but that PATCH is in
   * flight while the generate request is being sent, so without awaiting it the model would be handed the
   * previous version: type a description, press generate, get copy written as if the description did not
   * exist. Awaiting the editor's own flush closes the race with the mechanism that already exists rather
   * than posting the draft alongside the request.
   */
  saveFirst: () => Promise<void>;
}): ReactNode {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readiness = portfolioGenerationReadiness(value);
  /** Whether pressing would overwrite something. Any one of the four is enough to warrant asking. */
  const hasCopy = [
    value.headline?.trim(),
    value.biography?.trim(),
    value.brandSummary?.trim(),
    value.skills.length > 0 ? "x" : "",
  ].some((v) => v);

  const run = async (): Promise<void> => {
    if (hasCopy && !window.confirm(messages.portfolio.generateConfirm)) return;

    setPending(true);
    setError(null);

    try {
      await saveFirst();

      const response = await fetch(`/api/projects/${projectId}/portfolio-content`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ replaceExisting: hasCopy }),
      });

      if (!response.ok) {
        setError(problemMessage(await response.json().catch(() => null)));
        return;
      }

      onGenerated((await response.json()) as GeneratedPortfolioContent);
    } catch {
      setError(messages.errors.generic);
    } finally {
      setPending(false);
    }
  };

  /** Why the button is off, in the user's terms — never a bare disabled control. */
  const hint = (): string => {
    if (readiness.missingName) return messages.portfolio.generateNeedsName;
    if (!readiness.ready) {
      return messages.portfolio.generateNeedsSources(
        readiness.missing.map((k) => messages.portfolio.generateSources[k]),
      );
    }
    return messages.portfolio.generateHint;
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!readiness.ready || pending}
          onClick={() => void run()}
        >
          <Sparkles aria-hidden className="size-4" />
          {pending ? messages.portfolio.generating : messages.portfolio.generate}
        </Button>
        <p className="text-xs text-muted-foreground">{hint()}</p>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * The most specific message the problem body carries.
 *
 * **`meta.issues[0].message` before `detail`**, which is the opposite of what reading the field names
 * suggests. On a `422 VALIDATION_FAILED` the API's `detail` is the generic "Certains champs sont
 * invalides." and the sentence a user can act on — "Renseignez d'abord votre nom complet." — is in the
 * issues array. Verified against the live response, not inferred: taking `detail` showed the useless
 * half. Other codes have no issues, so `detail` is still the right fallback.
 */
function problemMessage(problem: unknown): string {
  if (!problem || typeof problem !== "object") return messages.errors.generic;

  const meta = (problem as { meta?: unknown }).meta;
  const issues =
    meta && typeof meta === "object" ? (meta as { issues?: unknown }).issues : undefined;

  if (Array.isArray(issues)) {
    const first: unknown = issues[0];
    if (first && typeof first === "object" && "message" in first) {
      return String(first.message);
    }
  }

  return "detail" in problem ? String(problem.detail) : messages.errors.generic;
}
