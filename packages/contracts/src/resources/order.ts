import { z } from "zod";

import { categoryCodeSchema } from "../enums/category";
import {
  orderStatusSchema,
  paymentProviderCodeSchema,
  paymentStatusSchema,
} from "../enums/billing";
import { moneySchema } from "../primitives/money";
import { pageRequestSchema, pageResponseSchema } from "../primitives/pagination";

/**
 * An order is the **intent** to buy; a payment is the money movement. Two resources, because a
 * bank transfer arrives days after the order, a declined card is a failed attempt against an
 * order that is still payable, and a refund is a second movement against an order already paid.
 * See ADR-0007.
 */

/**
 * The tax split, computed from the order's own `taxRateBp` snapshot — never from a live config
 * value, or a VAT change would rewrite every historical invoice.
 *
 * `amount` is what the customer pays (TTC, open question 3). The other two are derived and are
 * exposed so the invoice and the checkout summary cannot disagree with the server's arithmetic.
 */
export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  categoryCode: categoryCodeSchema,
  /** The snapshot, not a join to the live plan. */
  planCode: z.string(),
  planName: z.string(),

  amount: moneySchema,
  /** Basis points. 19% = 1900. Integer, for the same reason money is. */
  taxRateBp: z.number().int().min(0),
  amountExclTax: moneySchema,
  taxAmount: moneySchema,

  /** Assigned only on the transition to PAID. `REACCHY-YYYY-NNNNN`. */
  invoiceNumber: z.string().nullable(),
  paidAt: z.iso.datetime().nullable(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Order = z.infer<typeof orderSchema>;

/** `POST /orders`. The price is never sent by the client — it is snapshotted from the plan. */
export const createOrderRequestSchema = z
  .object({
    planCode: z.string().trim().min(1).max(64),
  })
  .strict();

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

/**
 * The `Idempotency-Key` header on `POST /orders`.
 *
 * Declared here rather than as a magic string in the controller so the web client and the API
 * spell it identically. A double-clicked "Choisir cette offre" must produce one order, not two.
 */
export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

export const idempotencyKeySchema = z.string().trim().min(8).max(255);

export const listOrdersQuerySchema = pageRequestSchema.extend({
  status: orderStatusSchema.optional(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const listOrdersResponseSchema = pageResponseSchema(orderSchema);

export type ListOrdersResponse = z.infer<typeof listOrdersResponseSchema>;

export const orderIdParamSchema = z.object({ id: z.string().min(1) });

export type OrderIdParam = z.infer<typeof orderIdParamSchema>;

/** A payment attempt against an order. Read-only over the wire — the provider writes these. */
export const paymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  provider: paymentProviderCodeSchema,
  status: paymentStatusSchema,
  amount: moneySchema,
  /** The gateway's transaction id. `null` for a manual activation. */
  providerRef: z.string().nullable(),
  occurredAt: z.iso.datetime(),
});

export type Payment = z.infer<typeof paymentSchema>;
