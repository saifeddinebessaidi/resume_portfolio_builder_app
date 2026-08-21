import type { Metadata, Viewport } from "next";
import { Geist, Inter, JetBrains_Mono, Poppins } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

import { Providers } from "@/components/providers";
import { messages } from "@/messages/fr";

/**
 * Self-hosted via next/font: the same three families the landing page uses, but served from our own
 * origin. No request to fonts.googleapis.com, and no layout shift on first paint because the metrics
 * are known at build time.
 */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/**
 * Geist — the sans the audited repository's portfolio design is set in.
 *
 * Declared here rather than in the public page because `next/font` must be called at module scope in a
 * layout to get the variable onto `<html>`. Only `.pf-root` consumes it, so the app's own screens keep
 * Inter; this is the public portfolio matching the design it was ported from, not a change of house font.
 */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${messages.app.name} — ${messages.app.tagline}`,
    template: `%s · ${messages.app.name}`,
  },
  description: messages.app.tagline,
  // The dashboard is private; there is nothing here for a crawler. Public portfolio pages set
  // their own metadata and opt back in.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#8B5CF6",
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html
      lang="fr"
      className={`${poppins.variable} ${inter.variable} ${jetbrainsMono.variable} ${geist.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
