import { type CategoryCode } from "@repo/contracts";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { messages } from "@/messages/fr";

/**
 * "Voir les offres", scoped to one category.
 *
 * The `category` query parameter is the point: the offers page lists all three categories, and a user
 * who pressed upgrade next to *Portfolio Pro* should not have to find it again in a page of nine plans.
 * `/offres` already reads this parameter — it is the same one a blocked download uses
 * (`?from=download&category=RESUME`), so this reuses a route contract rather than inventing one.
 *
 * A `Link`, not a button with an `onClick`: it is navigation, so it should middle-click, open in a new
 * tab, and be crawlable like any other link.
 */
export function UpgradeButton({
  categoryCode,
  size = "sm",
}: {
  categoryCode: CategoryCode;
  size?: "sm" | "md";
}): ReactNode {
  return (
    <Link
      href={`/offres?category=${categoryCode}`}
      className={cn(buttonVariants({ variant: "primary", size }))}
    >
      {messages.blocked.subscribeCta}
      <ArrowUpRight aria-hidden className="size-4" />
    </Link>
  );
}
