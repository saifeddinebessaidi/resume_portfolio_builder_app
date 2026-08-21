import { type Tx } from "./subscription.repository";

export const AUDIT_LOG = Symbol("AUDIT_LOG");

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
}

/**
 * A port, so a use case can record "who did this privileged thing" without importing Prisma.
 *
 * `record` takes the transaction: an audit row that commits when its subject rolled back is worse
 * than no audit row, because it asserts something happened that did not.
 */
export interface AuditLogPort {
  record(tx: Tx, entry: AuditEntry): Promise<void>;
}
