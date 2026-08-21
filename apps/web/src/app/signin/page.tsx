"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wordmark } from "@/components/shell/wordmark";
import { messages } from "@/messages/fr";

/**
 * Development sign-in.
 *
 * **This screen is temporary and does not exist in the product.** Authentication belongs to the
 * landing page (ADR-0001); this app has no login of its own and, once Supabase is wired in, an
 * unauthenticated visitor is redirected there instead. It exists now so the dashboard can be used
 * before that handoff is built — see phase 3 step 03.
 */
export default function SignInPage(): ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/dev-signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      setError(messages.errors.generic);
      setPending(false);
      return;
    }

    // refresh() re-runs the server components, so the layout's guard sees the new cookie.
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="rc-aurora rc-noise flex min-h-screen items-center justify-center px-6">
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Wordmark />
          <CardTitle className="rc-gradient-text mt-2 text-2xl">{messages.app.tagline}</CardTitle>
          <CardDescription>
            Connexion de développement — l&apos;authentification définitive arrive avec la page
            d&apos;accueil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-sm font-medium">
              {messages.account.email}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="rc-input"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" variant="primary" disabled={pending || email.length === 0}>
              {pending ? messages.common.loading : "Continuer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
