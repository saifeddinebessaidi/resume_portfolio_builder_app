import { EntitlementKey, type ResolvedEntitlement } from "@repo/contracts";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { messages } from "@/messages/fr";

const LABELS: Record<string, string> = {
  [EntitlementKey.PROJECT_CREATE_QUOTA]: messages.quota.createQuota,
  [EntitlementKey.REVISION_PER_PROJECT]: messages.quota.revisions,
  [EntitlementKey.EXPORT_PER_PROJECT]: messages.quota.exports,
  [EntitlementKey.PUBLICATION_SLOT]: messages.quota.publications,
  [EntitlementKey.CUSTOM_SLUG]: messages.quota.customSlug,
  [EntitlementKey.HOSTING_DAYS]: messages.quota.hosting,
  [EntitlementKey.ASSET_STORAGE_MB]: messages.quota.storage,
};

/**
 * Renders one resolved entitlement.
 *
 * The tone is the point: "1 restant" (warning) and "0 restant" (danger) must be distinguishable at a
 * glance, because that difference is the moment a user decides whether to renew. All the numbers come
 * straight from the server's `ResolvedEntitlement` — nothing is re-derived here, so the badge cannot
 * disagree with what the API will enforce.
 */
/**
 * Entitlements the API reports but no longer enforces, and which must therefore not be advertised.
 *
 * `REVISION_PER_PROJECT` is seeded on every plan and still resolves to a number, but ADR-0013 removed
 * the cap — nothing throws when it is exceeded. A badge reading "Modifications · 1 restant" would sell a
 * limit that does not exist, and with autosave the count moves on its own. The row stays in the database
 * so a cap could be reinstated; until it is, the UI stays quiet about it.
 */
const UNENFORCED: readonly string[] = [EntitlementKey.REVISION_PER_PROJECT];

export function QuotaBadge({ entitlement }: { entitlement: ResolvedEntitlement }): ReactNode {
  if (UNENFORCED.includes(entitlement.key)) return null;

  const label = LABELS[entitlement.key] ?? entitlement.key;

  if (entitlement.limit === null) {
    return (
      <Badge tone="info">
        {label} · {messages.quota.unlimited}
      </Badge>
    );
  }

  // `used === null` means this key is not period-metered — a per-project cap, or a flag like
  // CUSTOM_SLUG. Showing "0 sur 1 utilisés" for those would be actively misleading, so only the
  // allowance is shown.
  if (entitlement.used === null) {
    return (
      <Badge tone="neutral">
        {label} · {entitlement.limit}
      </Badge>
    );
  }

  const remaining = entitlement.remaining ?? 0;
  const tone = remaining === 0 ? "danger" : remaining === 1 ? "warning" : "success";

  return (
    <Badge tone={tone}>
      {label} · {messages.quota.remainingOf(remaining, entitlement.limit)}
    </Badge>
  );
}
