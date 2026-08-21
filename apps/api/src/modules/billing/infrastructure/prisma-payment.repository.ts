import { Injectable } from "@nestjs/common";
import { type Payment as PaymentRow, type Prisma } from "@prisma/client";
import { type Currency } from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type Payment } from "../domain/payment.entity";
import { type PaymentRepository, type RecordPaymentInput } from "../domain/payment.repository";
import { type Tx } from "../../subscriptions/domain/subscription.repository";

function client(prisma: PrismaService, tx: Tx): Prisma.TransactionClient {
  return (tx as Prisma.TransactionClient | undefined) ?? prisma;
}

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PaymentRow): Payment {
    return {
      id: row.id,
      orderId: row.orderId,
      provider: row.provider,
      status: row.status,
      amountMinor: row.amountMinor,
      currency: row.currency.trim() as Currency,
      providerRef: row.providerRef,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
    };
  }

  async record(tx: Tx, input: RecordPaymentInput): Promise<Payment> {
    const row = await client(this.prisma, tx).payment.create({
      data: {
        orderId: input.orderId,
        provider: input.provider,
        status: input.status,
        amountMinor: input.amountMinor,
        currency: input.currency,
        providerRef: input.providerRef ?? null,
        // Prisma types a nullable Json column as "a JSON value or the JSON null sentinel", never
        // `undefined`. With exactOptionalPropertyTypes the only spelling that both compiles and
        // leaves the column SQL NULL is a conditional spread.
        ...(input.rawPayload ? { rawPayload: input.rawPayload as Prisma.InputJsonValue } : {}),
        occurredAt: input.occurredAt,
      },
    });

    return this.toDomain(row);
  }

  async findForOrder(orderId: string, tx?: Tx): Promise<Payment[]> {
    const rows = await client(this.prisma, tx).payment.findMany({
      where: { orderId },
      orderBy: { occurredAt: "asc" },
    });

    return rows.map((r) => this.toDomain(r));
  }
}
