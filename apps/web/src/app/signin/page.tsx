import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthForm } from "@/features/auth/auth-form";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.auth.signInTitle };

export default function SignInPage(): ReactNode {
  return <AuthForm mode="signin" />;
}
