"use client";

import { PASSWORD_MIN_LENGTH } from "@repo/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wordmark } from "@/components/shell/wordmark";
import { messages } from "@/messages/fr";

const t = messages.auth;

/** One form for both screens: sign-up only adds the name field and the password-length hint. */
export function AuthForm({ mode }: { mode: "signin" | "signup" }): ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignUp = mode === "signup";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          email,
          password,
          ...(isSignUp && fullName.trim() ? { fullName: fullName.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const problem: unknown = await response.json().catch(() => null);
        setError(
          problem && typeof problem === "object" && "detail" in problem
            ? String(problem.detail)
            : messages.errors.generic,
        );
        setPending(false);
        return;
      }

      // refresh() re-runs the server components, so the layout's guard sees the new cookie.
      router.replace("/");
      router.refresh();
    } catch {
      setError(messages.errors.generic);
      setPending(false);
    }
  };

  return (
    <main className="rc-aurora rc-noise flex min-h-screen items-center justify-center px-6">
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Wordmark />
          <CardTitle className="rc-gradient-text mt-2 text-2xl">
            {isSignUp ? t.signUpTitle : t.signInTitle}
          </CardTitle>
          <CardDescription>{isSignUp ? t.signUpSubtitle : t.signInSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
            {isSignUp ? (
              <>
                <label htmlFor="fullName" className="text-sm font-medium">
                  {t.fullName}
                </label>
                <input
                  id="fullName"
                  autoComplete="name"
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rc-input"
                />
              </>
            ) : null}

            <label htmlFor="email" className="text-sm font-medium">
              {t.email}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="rc-input"
            />

            <label htmlFor="password" className="text-sm font-medium">
              {t.password}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={isSignUp ? PASSWORD_MIN_LENGTH : 1}
              maxLength={128}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rc-input"
            />
            {isSignUp ? (
              <p className="text-xs text-muted-foreground">{t.passwordHint(PASSWORD_MIN_LENGTH)}</p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? messages.common.loading : isSignUp ? t.signUp : t.signIn}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? t.haveAccount : t.noAccount}{" "}
            <Link
              href={isSignUp ? "/signin" : "/signup"}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {isSignUp ? t.toSignIn : t.toSignUp}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
