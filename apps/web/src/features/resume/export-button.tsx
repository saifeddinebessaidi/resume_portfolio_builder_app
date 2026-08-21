"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ENTITLEMENT_ERROR_CODES, type ErrorCode } from "@repo/contracts";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages/fr";

/**
 * Downloads the CV as a PDF.
 *
 * **The quota is consumed server-side before the print view opens.** `POST /projects/:id/exports`
 * records the export and returns `403 EXPORT_LIMIT_REACHED` when the plan's allowance is spent, so the
 * advertised "1 téléchargement par CV" is enforced by the API — not by hiding a button. Opening the
 * print window only happens after that call succeeds.
 *
 * The order matters and is the conservative one: charging before delivering means a user can cancel the
 * print dialog and still have spent the download. The alternative — print first, record after — lets
 * anyone take unlimited copies by dismissing the dialog, which is worse for a paid, capped resource.
 * Worth stating plainly to whoever revisits this.
 */
export function ExportButton({
  projectId,
  exportCount,
  exportLimit,
}: {
  projectId: string;
  exportCount: number;
  exportLimit: number | null;
}): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Never disabled for lack of a subscription. A user with no plan must still be able to *press*
  // Télécharger — pressing it is how they discover the offers, which is the point of the model.
  const spent = exportLimit !== null && exportCount >= exportLimit;

  const exportPdf = async () => {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/exports`, { method: "POST" });

    if (!response.ok) {
      const problem: unknown = await response.json().catch(() => null);
      const code =
        problem && typeof problem === "object" && "code" in problem
          ? (String(problem.code) as ErrorCode)
          : null;

      /**
       * **Any paywall refusal becomes a trip to the offers page**, not an error message.
       *
       * No subscription, an expired term, or the download allowance spent — from the user's side they
       * are all "you need a plan for this", and the useful response is showing them the plans rather
       * than a red sentence. `?from=download` lets that page explain why they arrived.
       */
      if (code && (ENTITLEMENT_ERROR_CODES as readonly ErrorCode[]).includes(code)) {
        // Category-scoped: a blocked CV download shows CV plans, not all nine.
        router.push("/offres?from=download&category=RESUME");
        return;
      }

      setError(
        problem && typeof problem === "object" && "detail" in problem
          ? String(problem.detail)
          : messages.errors.generic,
      );
      setPending(false);
      return;
    }

    // A new tab rather than an iframe: the print dialog belongs to a real document, and the user can
    // see what they are about to save. The tab closes itself once the dialog is dismissed.
    window.open(`/resume/${projectId}/print`, "_blank", "noopener");
    setPending(false);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="ghost" onClick={() => void exportPdf()} disabled={pending}>
        <Download aria-hidden className="size-4" />
        {pending ? messages.common.loading : messages.resume.download}
      </Button>

      <p className="text-xs text-muted-foreground">
        {exportLimit === null
          ? messages.offers.subscriptionNeeded
          : `${messages.quota.exports} ${exportCount}/${exportLimit}${spent ? " — " + messages.offers.upgradeShort : ""}`}
      </p>

      {error ? <p className="max-w-xs text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
