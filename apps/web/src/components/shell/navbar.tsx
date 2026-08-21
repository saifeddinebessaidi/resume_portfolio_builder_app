"use client";

import { CATEGORY_SLUGS } from "@repo/contracts";
import { FileText, LayoutDashboard, Menu, Palette, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Wordmark } from "./wordmark";
import { cn } from "@/lib/cn";
import { messages } from "@/messages/fr";

/**
 * **A navbar, and only a navbar.** No sidebar exists in this codebase — ADR-0010.
 *
 * Built to match the landing page's own header (`landing-chrome.tsx`): transparent at rest, and on
 * scroll it fades to `rgba(9,9,11,0.72)` with an 18px blur and a hairline border. The mobile
 * behaviour is the reference's too — a Menu/X toggle over a near-opaque obsidian panel, rather than
 * the horizontal scroll I had before.
 */
/**
 * No `/offres` tab, by your call.
 *
 * The **route still exists and is still reachable** — a blocked download sends the user to
 * `/offres?from=download&category=…` (ADR-0012), and the account screen links to it. Only the
 * permanent nav entry is gone, so the offers page is where a paywall takes you rather than a tab
 * competing with the four places a user actually works.
 */
const links = [
  { href: "/", label: messages.nav.home, icon: LayoutDashboard },
  { href: `/${CATEGORY_SLUGS.RESUME}`, label: messages.nav.resume, icon: FileText },
  { href: `/${CATEGORY_SLUGS.PORTFOLIO}`, label: messages.nav.portfolio, icon: Palette },
  { href: `/${CATEGORY_SLUGS.PORTFOLIO_PRO}`, label: messages.nav.portfolioPro, icon: Sparkles },
] as const;

export function Navbar({ email }: { email: string }): ReactNode {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className="sticky top-0 z-50 transition-all"
      style={{
        background: scrolled ? "rgba(9,9,11,0.72)" : "transparent",
        backdropFilter: scrolled ? "blur(18px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-10">
        <Wordmark />

        <nav aria-label={messages.nav.home} className="hidden items-center gap-8 text-sm md:flex">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "transition-colors",
                isActive(href) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/account"
            aria-current={isActive("/account") ? "page" : undefined}
            className="rc-btn rc-btn-ghost !px-4 !py-2 !text-xs"
          >
            <UserRound aria-hidden className="size-4" />
            <span className="hidden max-w-[18ch] truncate sm:inline">{email}</span>
          </Link>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="ml-1 text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          className="flex flex-col gap-4 px-6 pb-6 text-sm md:hidden"
          style={{ background: "rgba(9,9,11,0.95)" }}
        >
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              // Closed on click rather than in an effect keyed to the pathname: a synchronous
              // setState inside useEffect triggers a cascading render, and the click is the actual
              // event we care about. This is what the landing page's own header does.
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2",
                isActive(href) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
