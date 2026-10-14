import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthForm } from "@/features/auth/auth-form";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.auth.signUpTitle };

export default function SignUpPage(): ReactNode {
  return <AuthForm mode="signup" />;
}
