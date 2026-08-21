import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CategoryScreen } from "@/features/category/category-screen";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.nav.resume };

/** One line per category — the screen itself is shared. See ADR-0004. */
export default function Page(): Promise<ReactNode> {
  return CategoryScreen({ code: "RESUME" });
}
