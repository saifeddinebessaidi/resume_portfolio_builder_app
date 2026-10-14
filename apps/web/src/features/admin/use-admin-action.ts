"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { messages } from "@/messages/fr";

type Method = "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Runs one admin mutation through the `/api/admin/*` proxy, then re-renders the server components so
 * the screen shows what the API now says — no client-side cache to patch by hand.
 *
 * `path` is relative to `/admin`, e.g. `users/abc/access/EXPORT`.
 */
export function useAdminAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async (path: string, method: Method, body?: unknown): Promise<boolean> => {
    setPending(true);
    setError(null);
    setDone(false);

    try {
      const response = await fetch(`/api/admin/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        const problem: unknown = await response.json().catch(() => null);
        setError(
          problem && typeof problem === "object" && "detail" in problem
            ? String(problem.detail)
            : messages.errors.generic,
        );
        return false;
      }

      setDone(true);
      router.refresh();
      return true;
    } catch {
      setError(messages.errors.generic);
      return false;
    } finally {
      setPending(false);
    }
  };

  return { run, pending, error, done };
}
