"use client";

import { ACCESS_FEATURES, type AccessFeature, type AccessOverride } from "@repo/contracts";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionFeedback, ReasonInput, formatDate } from "./ui";
import { messages } from "@/messages/fr";
import { useAdminAction } from "./use-admin-action";

const t = messages.admin;

/**
 * One switch per section or action. "Activé" means "the plan decides" — an override can only take
 * access away; giving access to a category is a subscription grant.
 */
export function FeatureAccessPanel({
  userId,
  overrides,
}: {
  userId: string;
  overrides: AccessOverride[];
}): ReactNode {
  const [reason, setReason] = useState("");
  const { run, pending, error, done } = useAdminAction();
  const byFeature = new Map(overrides.map((o) => [o.feature, o]));

  const toggle = async (feature: AccessFeature, enabled: boolean) => {
    const ok = await run(`users/${userId}/access/${feature}`, "PUT", {
      enabled,
      reason: reason.trim(),
    });
    if (ok) setReason("");
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t.detail.accessHelp}</p>
      <ReasonInput value={reason} onChange={(e) => setReason(e.target.value)} />

      <ul className="flex flex-col divide-y divide-border">
        {ACCESS_FEATURES.map((feature) => {
          const override = byFeature.get(feature);
          const enabled = override?.enabled ?? true;

          return (
            <li key={feature} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{t.features[feature]}</span>
                {override && !override.enabled ? (
                  <span className="text-xs text-muted-foreground">
                    {override.reason} — {override.updatedBy.email}, {formatDate(override.updatedAt)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={enabled ? "success" : "warning"}>
                  {enabled ? t.actions.enabled : t.actions.disabled}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending || reason.trim() === ""}
                  title={reason.trim() === "" ? t.actions.reasonRequired : undefined}
                  onClick={() => void toggle(feature, !enabled)}
                >
                  {enabled ? t.actions.disable : t.actions.enable}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <ActionFeedback error={error} done={done} />
    </div>
  );
}
