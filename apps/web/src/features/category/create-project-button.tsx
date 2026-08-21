"use client";

import { type CategoryCode } from "@repo/contracts";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages/fr";

/**
 * Creates a project and lands the user in it.
 *
 * Goes through a route handler rather than calling the API from the browser: the bearer token lives in
 * an httpOnly cookie that script cannot read, which is the whole point of storing it that way. The
 * handler runs server-side, where the cookie is available.
 *
 * On failure it shows the API's own `detail` — the server already writes a French, user-facing message
 * with the real numbers in it ("Vous avez utilisé 3 sur 3…"), so re-inventing copy here would only
 * risk saying something less accurate.
 */
export function CreateProjectButton({
  categoryCode,
  label,
  disabled = false,
}: {
  categoryCode: CategoryCode;
  label: string;
  disabled?: boolean;
}): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryCode }),
      });

      if (!response.ok) {
        const problem: unknown = await response.json().catch(() => null);
        const detail =
          problem && typeof problem === "object" && "detail" in problem
            ? String(problem.detail)
            : messages.errors.generic;
        setError(detail);
        setPending(false);
        return;
      }

      /**
       * **Every category now lands in its editor.**
       *
       * This used to special-case RESUME and fall through to `router.refresh()` for the other two,
       * because no portfolio editor existed — which produced exactly the reported behaviour: pressing
       * "Créer mon portfolio" added a row to the table and went nowhere. The route map is the single
       * source of truth for where a category's editor lives, so a category without one still refreshes
       * rather than pushing to a 404.
       */
      const created: unknown = await response.json().catch(() => null);
      const id =
        created && typeof created === "object" && "id" in created ? String(created.id) : null;

      /**
       * Written as a switch with literal templates, not a lookup table of path segments.
       *
       * Next 16 types `router.push`, and a route built from a variable segment
       * (`` `/${segment}/${id}` ``) is not statically checkable — so the compiler rejects it. Spelling
       * each destination out is what makes a typo here a build error instead of a 404, which is the same
       * reason `ROUTES` exists for the API paths.
       */
      if (id) {
        switch (categoryCode) {
          case "RESUME":
            router.push(`/resume/${id}`);
            break;
          case "PORTFOLIO":
            router.push(`/portfolio/${id}`);
            break;
          case "PORTFOLIO_PRO":
            router.push(`/portfolio-pro/${id}`);
            break;
        }
        setPending(false);
        return;
      }

      {
        // refresh() re-runs the server components, so the new project appears in the list and the
        // quota badges move — without a second fetch or a client cache to keep in step.
        router.refresh();
      }
      setPending(false);
    } catch {
      setError(messages.errors.generic);
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="primary"
        size="lg"
        disabled={disabled || pending}
        onClick={() => void create()}
      >
        <Plus aria-hidden className="size-4" />
        {pending ? messages.common.loading : label}
      </Button>

      {error ? <p className="max-w-md text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
