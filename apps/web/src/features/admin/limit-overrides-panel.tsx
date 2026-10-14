"use client";

import {
  CATEGORY_CODES,
  ENTITLEMENT_KEYS,
  type CategoryCode,
  type CategoryEntitlements,
  type EntitlementKey,
  type EntitlementOverride,
} from "@repo/contracts";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ActionFeedback, Input, ReasonInput, Select, Td, Th } from "./ui";
import { messages } from "@/messages/fr";
import { useAdminAction } from "./use-admin-action";

const t = messages.admin;

const show = (limit: number | null | undefined): string =>
  limit === undefined ? "—" : limit === null ? messages.quota.unlimited : String(limit);

/**
 * Per-user quota overrides. "Offre" is the plan's declared limit, "Personnalisé" the override, and
 * "Appliqué" what enforcement uses right now — read back from the API, not computed here.
 */
export function LimitOverridesPanel({
  userId,
  overrides,
  entitlements,
  planLimits,
}: {
  userId: string;
  overrides: EntitlementOverride[];
  entitlements: CategoryEntitlements[];
  /** The active plan's own limits per category, keyed `${category}:${key}`. */
  planLimits: Record<string, number | null>;
}): ReactNode {
  const [category, setCategory] = useState<CategoryCode>("RESUME");
  const [key, setKey] = useState<EntitlementKey>("PROJECT_CREATE_QUOTA");
  const [value, setValue] = useState("");
  // Explicit, so an empty field can never silently mean "unlimited".
  const [unlimited, setUnlimited] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending, error, done } = useAdminAction();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run(`users/${userId}/entitlement-overrides`, "PUT", {
      categoryCode: category,
      key,
      limitValue: unlimited ? null : Number(value),
      reason: reason.trim(),
    });
    if (ok) {
      setValue("");
      setUnlimited(false);
      setReason("");
    }
  };

  const reset = async (o: EntitlementOverride) => {
    if (reason.trim() === "") return;
    const ok = await run(
      `users/${userId}/entitlement-overrides/${o.categoryCode}/${o.key}`,
      "DELETE",
      {
        reason: reason.trim(),
      },
    );
    if (ok) setReason("");
  };

  const effective = (c: CategoryCode, k: EntitlementKey) =>
    entitlements.find((e) => e.categoryCode === c)?.entitlements.find((e) => e.key === k)?.limit;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t.detail.limitsHelp}</p>

      {overrides.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-border">
              <tr>
                <Th>{t.orders.plan}</Th>
                <Th>{t.detail.limits}</Th>
                <Th>{t.detail.planLimit}</Th>
                <Th>{t.detail.override}</Th>
                <Th>{t.detail.effective}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr
                  key={`${o.categoryCode}:${o.key}`}
                  className="border-b border-border last:border-0"
                >
                  <Td>{t.features[o.categoryCode]}</Td>
                  <Td>
                    {t.entitlementKeys[o.key]}
                    {o.reason ? <p className="text-xs text-muted-foreground">{o.reason}</p> : null}
                  </Td>
                  <Td>{show(planLimits[`${o.categoryCode}:${o.key}`])}</Td>
                  <Td className="font-medium">{show(o.limitValue)}</Td>
                  <Td>{show(effective(o.categoryCode, o.key))}</Td>
                  <Td>
                    <Button
                      type="button"
                      size="sm"
                      variant="quiet"
                      disabled={pending || reason.trim() === ""}
                      title={reason.trim() === "" ? t.actions.reasonRequired : undefined}
                      onClick={() => void reset(o)}
                    >
                      {t.actions.reset}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value as CategoryCode)}>
            {CATEGORY_CODES.map((c) => (
              <option key={c} value={c}>
                {t.features[c]}
              </option>
            ))}
          </Select>
          <Select value={key} onChange={(e) => setKey(e.target.value as EntitlementKey)}>
            {ENTITLEMENT_KEYS.map((k) => (
              <option key={k} value={k}>
                {t.entitlementKeys[k]}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`${t.detail.planLimit} : ${show(planLimits[`${category}:${key}`])}`}
            className="w-44"
            disabled={unlimited}
            required={!unlimited}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(e) => setUnlimited(e.target.checked)}
            />
            {messages.quota.unlimited}
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReasonInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={pending || reason.trim() === "" || (!unlimited && value.trim() === "")}
          >
            {t.actions.apply}
          </Button>
        </div>
      </form>
      <ActionFeedback error={error} done={done} />
    </div>
  );
}
