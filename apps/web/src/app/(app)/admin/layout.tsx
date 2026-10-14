import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AdminTabs } from "@/features/admin/admin-tabs";
import { meApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

/**
 * The back office's shell. A non-admin gets a 404 rather than a 403, so the area's existence is not
 * advertised. **This is a courtesy, not the control**: every `/admin/*` API route carries
 * `@Roles("ADMIN")`, so a page that slipped past this check would still receive nothing.
 *
 * The parent `(app)` layout has already redirected an unauthenticated visitor to /signin.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const me = await meApi.get();
  if (me.role !== "ADMIN") notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">
        <span className="rc-gradient-text">{messages.admin.title}</span>
      </h1>
      <AdminTabs />
      {children}
    </div>
  );
}
