-- Phase 7 step 01 — orders & payments schema.
--
-- Three changes, all additive to the billing tables the init migration already created:
--   1. Order.idempotencyKey becomes unique PER USER rather than globally.
--   2. The IdempotencyKey table, which is what lets a replay be told from a key reused with a
--      different body.
--   3. One invoice-number sequence per year.

-- -----------------------------------------------------------------------------------------
-- 1. Idempotency keys are client-generated. A global unique index makes them a shared
--    namespace: two customers picking the same UUID collide, and one account can probe whether
--    another has used a given key. Scoped to the user, neither is possible. NULLs stay distinct
--    in a multi-column unique index, so unkeyed orders are unaffected.
-- -----------------------------------------------------------------------------------------
DROP INDEX "Order_idempotencyKey_key";

CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

-- -----------------------------------------------------------------------------------------
-- 2. The replay record.
--
--    requestHash is what distinguishes the two cases the header has to handle: the same key with
--    the same body is a retry and must return the original order; the same key with a different
--    body is a client bug and must 409. The unique index on the primary key is also the
--    concurrency control — two simultaneous requests with one key serialise on it, the loser
--    blocks until the winner commits, and then replays rather than creating a second order.
-- -----------------------------------------------------------------------------------------
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("userId","key")
);

-- Pruning: keys older than 24 hours are deleted, which is far longer than any retry window.
CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------------------
-- 3. Invoice numbering — a sequence per year, not count(*) + 1.
--
--    nextval is atomic and never returns the same value twice, including across concurrent
--    transactions. count(*) + 1 hands two simultaneous callers the same number and the unique
--    constraint then fails one of them at random.
--
--    Numbers reset yearly because the format is REACCHY-{YYYY}-{NNNNN}, so a single global
--    sequence would make 2027 start at wherever 2026 stopped.
--
--    Pre-created for a decade rather than created lazily on first use of a new year: lazy
--    creation means DDL at request time, and Neon's pooled connection runs in transaction mode
--    where DDL is not reliable. A sequence that is never used costs nothing. The phase 10
--    runbook records that a migration must extend this range before 2037.
-- -----------------------------------------------------------------------------------------
DO $$
DECLARE
    y INT;
BEGIN
    FOR y IN 2026..2036 LOOP
        EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', 'invoice_number_seq_' || y);
    END LOOP;
END $$;
