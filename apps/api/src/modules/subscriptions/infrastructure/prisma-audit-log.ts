import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type AuditEntry, type AuditLogPort } from "../domain/audit-log.port";
import { type Tx } from "../domain/subscription.repository";

@Injectable()
export class PrismaAuditLog implements AuditLogPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Tx, entry: AuditEntry): Promise<void> {
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma;

    await client.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        // Prisma types a nullable Json column as "a JSON value, or the JSON null sentinel" — never
        // `undefined`. With `exactOptionalPropertyTypes`, passing `undefined` explicitly is a
        // different type from omitting the key, so the only spelling that both compiles and leaves
        // the column SQL NULL is a conditional spread.
        ...(entry.before ? { before: entry.before as Prisma.InputJsonValue } : {}),
        ...(entry.after ? { after: entry.after as Prisma.InputJsonValue } : {}),
        ip: entry.ip ?? null,
      },
    });
  }
}
