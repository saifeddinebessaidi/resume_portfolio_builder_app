import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";

import { PrismaService } from "./prisma.service";

/** The transaction-scoped client a callback receives. Repositories accept this or the service. */
export type TransactionClient = Prisma.TransactionClient;

/**
 * The only sanctioned way to span multiple writes.
 *
 * It exists so that quota consumption and the mutation it authorizes share **one** transaction.
 * The increment-then-verify sequence is meaningless if the two halves can commit independently:
 * increment the counter, find it over the limit, throw — and the increment must roll back with
 * everything else, or the user has lost quota for a project that was never created.
 *
 * Timeouts are explicit because the defaults (5s/2s) are tight for Neon's free tier, where a
 * cold start alone can consume most of the window.
 */
@Injectable()
export class UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, {
      /**
       * How long the transaction may hold open once started.
       *
       * 30s, not Prisma's 5s default and not the 10s this originally had. Measured against Neon's
       * free tier a first-request round trip can take 10s on its own (cold start plus the pooler),
       * so a three-statement transaction genuinely needs more headroom than a local Postgres would.
       * A timeout here surfaces as P2028, which is unmapped and therefore a 500 — an infrastructure
       * latency spike showing up as "our bug" is exactly the wrong diagnosis to hand someone.
       */
      timeout: 30_000,
      /** How long to wait for a connection from the pool before giving up. */
      maxWait: 10_000,
    });
  }

  /**
   * Serialisable isolation, for the rare operation where the default Read Committed is not
   * enough — a read whose result decides a write, where a phantom row would change the answer.
   *
   * Quota consumption does NOT need this: it relies on the `UsageCounter` unique constraint and
   * the row lock the upsert takes, which serialises the contending writers without paying for
   * serialisable isolation on every request.
   */
  runSerializable<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, {
      timeout: 10_000,
      maxWait: 5_000,
      isolationLevel: "Serializable",
    });
  }
}
