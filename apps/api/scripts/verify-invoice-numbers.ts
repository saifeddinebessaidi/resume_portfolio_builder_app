/**
 * Phase 7 step 01 — the acceptance check that cannot be done with curl.
 *
 * Two properties, both of which only fail under concurrency and would otherwise be discovered by
 * an accountant:
 *
 *   1. **20 simultaneous transitions to PAID produce 20 distinct invoice numbers.** This is what
 *      `count(*) + 1` gets wrong — two transactions read the same count, format the same number,
 *      and the unique constraint rejects one of them at the moment money has already moved.
 *   2. **`amountExclTax() + totalTax() === amountMinor` exactly, for every price in the catalog.**
 *      Integer arithmetic has no rounding slack to hide in; either it is exact or an invoice is
 *      off by a millime.
 *
 * Run: `pnpm --filter @repo/api verify:invoice-numbers`
 *
 * Writes to whatever DATABASE_URL points at, then removes everything it created. The user it
 * provisions carries a fixed marker email so a failed run leaves something identifiable behind
 * rather than an anonymous orphan.
 */
import { PrismaClient } from "@prisma/client";
import { config as loadDotenv } from "dotenv";

import {
  INVOICE_NUMBER_PATTERN,
  amountExclTax,
  formatInvoiceNumber,
  totalTax,
} from "../src/modules/billing/domain/order.entity";

loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const CONCURRENCY = 20;
const MARKER = "verify-invoice-numbers@reacchy.invalid";

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** The same expression the service uses, so the script proves the service rather than restating it. */
async function issueNumber(tx: Pick<PrismaClient, "$queryRaw">, year: number): Promise<string> {
  const sequence = `invoice_number_seq_${String(year)}`;
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval(${sequence}::regclass)`;
  return formatInvoiceNumber(year, Number(rows[0]?.nextval ?? 0));
}

async function main(): Promise<void> {
  const year = new Date().getUTCFullYear();
  console.log(`\nInvoice numbering & tax arithmetic — year ${String(year)}\n`);

  // ---------------------------------------------------------------------------------------
  // 1. Tax arithmetic, for every price actually in the catalog. No fixtures: a hand-written
  //    list of prices would keep passing after someone edits a plan.
  // ---------------------------------------------------------------------------------------
  console.log("Tax split (TTC → HT + TVA), every catalog price:");

  const plans = await prisma.plan.findMany({
    select: { code: true, priceMinor: true },
    orderBy: { priceMinor: "asc" },
  });

  const taxRateBp = Number(process.env.BILLING_TAX_RATE_BP ?? 1900);
  const distinctPrices = [...new Set(plans.map((p) => p.priceMinor))];

  for (const priceMinor of distinctPrices) {
    const order = { amountMinor: priceMinor, taxRateBp };
    const ht = amountExclTax(order);
    const tva = totalTax(order);

    check(
      `${String(priceMinor)} millimes`,
      ht + tva === priceMinor && ht > 0 && tva > 0,
      `HT ${String(ht)} + TVA ${String(tva)} = ${String(ht + tva)}`,
    );
  }

  // ---------------------------------------------------------------------------------------
  // 2. Concurrent invoice numbering. Each worker runs its own transaction, exactly as a real
  //    payment would, and they are started together rather than awaited in sequence.
  // ---------------------------------------------------------------------------------------
  console.log(`\n${String(CONCURRENCY)} concurrent transitions to PAID:`);

  const plan = await prisma.plan.findFirst({
    where: { isActive: true },
    include: { category: { select: { id: true } } },
  });

  if (!plan) throw new Error("No active plan found — run `pnpm --filter @repo/api db:seed` first.");

  const user = await prisma.user.upsert({
    where: { email: MARKER },
    update: {},
    create: {
      email: MARKER,
      externalAuthId: `verify-script-${String(Date.now())}`,
      fullName: "Verify Script",
    },
  });

  const orders = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      prisma.order.create({
        data: {
          userId: user.id,
          planId: plan.id,
          categoryId: plan.categoryId,
          status: "PENDING",
          amountMinor: plan.priceMinor,
          currency: plan.currency,
          taxRateBp,
          planCodeSnapshot: plan.code,
        },
        select: { id: true },
      }),
    ),
  );

  const settled = await Promise.allSettled(
    orders.map((order) =>
      prisma.$transaction(
        async (tx) => {
          const invoiceNumber = await issueNumber(tx, year);

          const result = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "PAID", invoiceNumber, paidAt: new Date() },
          });

          if (result.count !== 1) throw new Error(`Order ${order.id} was not PENDING`);

          return invoiceNumber;
        },
        { timeout: 30_000, maxWait: 10_000 },
      ),
    ),
  );

  const issued = settled
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value);

  const rejected = settled.filter((r) => r.status === "rejected");
  for (const r of rejected) {
    console.error(`  ⚠ transaction failed: ${String(r.reason)}`);
  }

  check(
    `${String(CONCURRENCY)} transactions all committed`,
    issued.length === CONCURRENCY,
    `${String(issued.length)} succeeded, ${String(rejected.length)} failed`,
  );

  check(
    "every number is distinct",
    new Set(issued).size === issued.length,
    `${String(new Set(issued).size)} distinct of ${String(issued.length)}`,
  );

  check(
    "every number matches REACCHY-YYYY-NNNNN",
    issued.every((n) => INVOICE_NUMBER_PATTERN.test(n)),
    issued.length > 0 ? `e.g. ${issued[0] ?? ""}` : "",
  );

  // The database's own view, not the application's: this is what a duplicate would look like to
  // the unique constraint, and it also proves the numbers were actually persisted.
  const persisted = await prisma.order.findMany({
    where: { id: { in: orders.map((o) => o.id) } },
    select: { invoiceNumber: true, status: true },
  });

  check(
    "every order is PAID with a stored number",
    persisted.every((o) => o.status === "PAID" && o.invoiceNumber !== null),
    `${String(persisted.filter((o) => o.invoiceNumber !== null).length)}/${String(persisted.length)}`,
  );

  // ---------------------------------------------------------------------------------------
  // 3. A number is assigned ONLY on PAID — a canceled order must not consume one.
  // ---------------------------------------------------------------------------------------
  console.log("\nCancellation does not consume a number:");

  const canceled = await prisma.order.create({
    data: {
      userId: user.id,
      planId: plan.id,
      categoryId: plan.categoryId,
      status: "PENDING",
      amountMinor: plan.priceMinor,
      currency: plan.currency,
      taxRateBp,
      planCodeSnapshot: plan.code,
    },
  });

  await prisma.order.updateMany({
    where: { id: canceled.id, status: "PENDING" },
    data: { status: "CANCELED" },
  });

  const after = await prisma.order.findUniqueOrThrow({ where: { id: canceled.id } });
  check("canceled order has no invoice number", after.invoiceNumber === null, after.status);

  // ---------------------------------------------------------------------------------------
  // Cleanup. Payments reference orders with onDelete: Restrict, but this script records none.
  // ---------------------------------------------------------------------------------------
  await prisma.order.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("\nCleaned up.");

  if (failures > 0) {
    console.error(`\n${String(failures)} check(s) FAILED\n`);
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.\n");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
