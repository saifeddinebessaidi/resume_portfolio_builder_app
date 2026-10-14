import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { messages } from "@/messages/fr";

/**
 * The few form primitives the back office needs. Native elements with the app's tokens rather than
 * new shadcn components: these screens are internal, and native controls are accessible as they are.
 */
export const fieldClass =
  "rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

export function Input({ className, ...props }: ComponentProps<"input">): ReactNode {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">): ReactNode {
  return <select className={cn(fieldClass, "bg-background", className)} {...props} />;
}

export function ReasonInput(props: ComponentProps<"input">): ReactNode {
  return (
    <Input
      required
      minLength={1}
      maxLength={500}
      placeholder={messages.admin.actions.reason}
      aria-label={messages.admin.actions.reason}
      {...props}
    />
  );
}

export function ActionFeedback({
  error,
  done,
}: {
  error: string | null;
  done: boolean;
}): ReactNode {
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (done) return <p className="text-xs text-muted-foreground">{messages.admin.actions.done}</p>;
  return null;
}

export function Th({ className, ...props }: ComponentProps<"th">): ReactNode {
  return (
    <th
      className={cn("px-4 py-3 text-left text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">): ReactNode {
  return <td className={cn("px-4 py-3 align-top text-sm", className)} {...props} />;
}

export const formatDate = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(iso),
      )
    : "—";
