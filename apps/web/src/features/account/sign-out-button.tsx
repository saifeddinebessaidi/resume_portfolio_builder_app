"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages/fr";

/**
 * Clears the session cookie server-side.
 *
 * A request rather than a client-side delete, because the cookie is httpOnly and script cannot touch
 * it — which is the point of storing it that way.
 */
export function SignOutButton(): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void fetch("/dev-signin", { method: "DELETE" }).then(() => {
          router.replace("/signin");
          router.refresh();
        });
      }}
    >
      {messages.nav.signOut}
    </Button>
  );
}
