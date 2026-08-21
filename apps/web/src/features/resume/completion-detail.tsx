"use client";

import { type ResumeCompletion } from "@repo/contracts";
import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { messages } from "@/messages/fr";

/**
 * Which sections the percentage is made of, and what each is worth.
 *
 * The bar alone invites exactly one question — "why that number?" — and it was asked immediately. A
 * percentage a user cannot audit is one they argue with; this makes it arithmetic they can check, and it
 * doubles as the to-do list for finishing the CV.
 *
 * Ordered by the step table, not by done-ness: a list that reshuffles as you fill it in is disorienting,
 * and the fixed order lets someone learn where each section sits.
 */
export function CompletionDetail({ completion }: { completion: ResumeCompletion }): ReactNode {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {messages.quota.progressDetail}
      </summary>

      <ul className="mt-2 flex flex-col gap-1">
        {completion.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2">
            {step.done ? (
              <Check aria-hidden className="size-3.5 shrink-0 text-[var(--cyan)]" />
            ) : (
              <Minus aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
              {messages.quota.progressSteps[step.key]}
            </span>
            {/* The weight, so the total is visibly the sum of the ticks rather than a black box. */}
            <span className="ml-auto tabular-nums text-muted-foreground">
              {messages.quota.percent(step.weight)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
