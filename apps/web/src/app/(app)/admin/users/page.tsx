import {
  type AdminListUsersQuery,
  USER_ROLES,
  USER_STATUSES,
  userRoleSchema,
  userStatusSchema,
} from "@repo/contracts";
import type { Metadata, Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Td, Th, formatDate } from "@/features/admin/ui";
import { adminApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.admin.tabs.users };

const t = messages.admin.users;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; cursor?: string }>;
}): Promise<ReactNode> {
  const params = await searchParams;

  // Unknown filter values are dropped rather than forwarded: a hand-edited URL should show
  // everything, not a 422.
  const role = userRoleSchema.safeParse(params.role);
  const status = userStatusSchema.safeParse(params.status);
  const query: Partial<AdminListUsersQuery> = {
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(role.success ? { role: role.data } : {}),
    ...(status.success ? { status: status.data } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
  };

  const page = await adminApi.users(query);

  const nextHref: Route | null = page.nextCursor
    ? `/admin/users?${new URLSearchParams({
        ...(query.q ? { q: query.q } : {}),
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
        cursor: page.nextCursor,
      }).toString()}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-center gap-2" action="/admin/users">
        <Input
          name="q"
          type="search"
          defaultValue={query.q ?? ""}
          placeholder={t.search}
          aria-label={t.search}
          className="min-w-64 flex-1"
        />
        <Select name="role" defaultValue={query.role ?? ""} aria-label={t.role}>
          <option value="">{t.allRoles}</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {messages.admin.roles[r]}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={query.status ?? ""} aria-label={t.status}>
          <option value="">{t.allStatuses}</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {messages.admin.statuses[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="ghost">
          {t.filter}
        </Button>
      </form>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-border">
            <tr>
              <Th>{t.email}</Th>
              <Th>{t.role}</Th>
              <Th>{t.status}</Th>
              <Th>{messages.admin.detail.subscriptions}</Th>
              <Th>{t.access}</Th>
              <Th>{t.createdAt}</Th>
              <Th>{t.lastSeen}</Th>
            </tr>
          </thead>
          <tbody>
            {page.items.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-muted-foreground">
                  {t.none}
                </Td>
              </tr>
            ) : (
              page.items.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <Td>
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                      {u.email}
                    </Link>
                    {u.fullName ? (
                      <p className="text-xs text-muted-foreground">{u.fullName}</p>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={u.role === "ADMIN" ? "info" : "neutral"}>
                      {messages.admin.roles[u.role]}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={u.status === "ACTIVE" ? "success" : "warning"}>
                      {messages.admin.statuses[u.status]}
                    </Badge>
                  </Td>
                  <Td className="text-xs">
                    {u.activeCategories.length === 0
                      ? "—"
                      : u.activeCategories.map((c) => messages.admin.features[c]).join(", ")}
                  </Td>
                  <Td>
                    {u.disabledFeatures.length > 0 ? (
                      <Badge tone="warning">{t.restricted(u.disabledFeatures.length)}</Badge>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-xs">{formatDate(u.createdAt)}</Td>
                  <Td className="text-xs">{formatDate(u.lastSeenAt)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {nextHref ? (
        <Link
          href={nextHref}
          className="self-end text-sm text-muted-foreground hover:text-foreground"
        >
          {t.next} →
        </Link>
      ) : null}
    </div>
  );
}
