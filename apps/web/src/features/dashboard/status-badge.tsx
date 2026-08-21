import { type ProjectStatus } from "@repo/contracts";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { messages } from "@/messages/fr";

/**
 * The project status, coloured.
 *
 * Every status used to render `neutral` except `PUBLISHED`, so a glance down the column told the reader
 * nothing — "Brouillon" and "Prêt" looked identical, which is exactly the distinction someone scanning
 * their CVs is looking for.
 *
 * The tones encode **how finished the thing is**, not an arbitrary palette:
 *
 * | Status | Tone | Why |
 * | --- | --- | --- |
 * | `DRAFT` | warning | Work in progress. Not wrong, not done — the same amber as a quota running low |
 * | `READY` | info | Finished and ready to send. The brand indigo, because this is the good state |
 * | `PUBLISHED` | success | Live and reachable by someone else |
 * | `ARCHIVED` | neutral | Deliberately set aside; it should recede rather than compete |
 *
 * Extracted into its own component because the dashboard table, the category screen and the editor all
 * render a status, and three copies of this mapping would drift.
 */
const TONE: Record<ProjectStatus, "neutral" | "info" | "success" | "warning"> = {
  DRAFT: "warning",
  READY: "info",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export function StatusBadge({ status }: { status: ProjectStatus }): ReactNode {
  return <Badge tone={TONE[status]}>{messages.status[status]}</Badge>;
}
