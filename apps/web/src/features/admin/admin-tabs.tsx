"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { messages } from "@/messages/fr";

const tabs = [
  { href: "/admin", label: messages.admin.tabs.overview },
  { href: "/admin/users", label: messages.admin.tabs.users },
  { href: "/admin/orders", label: messages.admin.tabs.orders },
  { href: "/admin/plans", label: messages.admin.tabs.plans },
] as const;

export function AdminTabs(): ReactNode {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav
      aria-label={messages.admin.title}
      className="flex gap-6 overflow-x-auto border-b border-border text-sm"
    >
      {tabs.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 pb-3 transition-colors",
            isActive(href)
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
