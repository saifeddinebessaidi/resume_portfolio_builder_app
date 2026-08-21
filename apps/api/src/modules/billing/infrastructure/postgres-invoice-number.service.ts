import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";

import { InternalError } from "../../../common/errors/errors";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { formatInvoiceNumber } from "../domain/order.entity";
import { type InvoiceNumberService } from "../domain/invoice-number.service";
import { type Tx } from "../../subscriptions/domain/subscription.repository";

/**
 * The years the migration pre-creates sequences for. Extending the range is a migration, not a
 * code change — recorded in the phase 10 runbook.
 */
const FIRST_YEAR = 2026;
const LAST_YEAR = 2036;

function client(prisma: PrismaService, tx: Tx): Prisma.TransactionClient {
  return (tx as Prisma.TransactionClient | undefined) ?? prisma;
}

/**
 * Invoice numbers from a Postgres sequence, one per year.
 *
 * `nextval` is atomic and never hands the same value to two callers, including across concurrent
 * transactions — which is the only property that matters here, and the one `count(*) + 1` does not
 * have. Two simultaneous payments computing a count read the same number, and the unique
 * constraint then rejects one of them at random, at the worst possible moment.
 *
 * **Numbers can have gaps.** A sequence does not roll back: if the surrounding transaction aborts
 * after `nextval`, that number is spent and never appears on an invoice. That is accepted and
 * normal — an accountant can explain a gap, whereas two invoices sharing a number is a genuine
 * problem. Gaplessness and concurrency safety cannot both be had without serialising every
 * payment behind one lock.
 */
@Injectable()
export class PostgresInvoiceNumberService implements InvoiceNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async next(tx: Tx, year: number): Promise<string> {
    if (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR) {
      throw new InternalError(
        `No invoice sequence exists for ${String(year)}. Sequences are pre-created for ` +
          `${String(FIRST_YEAR)}–${String(LAST_YEAR)}; extend the range with a migration.`,
      );
    }

    const sequence = `invoice_number_seq_${String(year)}`;

    // Parameterised and cast to regclass rather than interpolated into the SQL text: the year is
    // already validated above, but a raw query that concatenates an identifier is a pattern worth
    // never establishing in a billing module.
    const rows = await client(this.prisma, tx).$queryRaw<
      { nextval: bigint }[]
    >`SELECT nextval(${sequence}::regclass)`;

    const value = rows[0]?.nextval;
    if (value === undefined) {
      throw new InternalError(`nextval('${sequence}') returned no row.`);
    }

    return formatInvoiceNumber(year, Number(value));
  }
}
