"use client";

import {
  type MeResponse,
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from "@repo/contracts";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ActionFeedback, ReasonInput, Select } from "./ui";
import { messages } from "@/messages/fr";
import { useAdminAction } from "./use-admin-action";

const t = messages.admin;

/** Role and status. The API refuses self-edits and removing the last admin; the UI only mirrors it. */
export function UserProfileControls({
  user,
  isSelf,
}: {
  user: MeResponse;
  isSelf: boolean;
}): ReactNode {
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [reason, setReason] = useState("");
  const { run, pending, error, done } = useAdminAction();

  if (isSelf) return <p className="text-sm text-muted-foreground">{t.detail.self}</p>;

  const changed = role !== user.role || status !== user.status;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run(`users/${user.id}`, "PATCH", {
      ...(role !== user.role ? { role } : {}),
      ...(status !== user.status ? { status } : {}),
      reason: reason.trim(),
    });
    if (ok) setReason("");
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          aria-label={t.users.role}
        >
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {t.roles[r]}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as UserStatus)}
          aria-label={t.users.status}
        >
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.statuses[s]}
            </option>
          ))}
        </Select>
      </div>
      {changed ? (
        <div className="flex flex-wrap gap-2">
          <ReasonInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={pending || reason.trim() === ""}>
            {t.actions.save}
          </Button>
        </div>
      ) : null}
      <ActionFeedback error={error} done={done} />
    </form>
  );
}
