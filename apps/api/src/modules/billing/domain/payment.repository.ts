import { type Currency, type PaymentProviderCode, type PaymentStatus } from "@repo/contracts";

import { type Tx } from "../../subscriptions/domain/subscription.repository";
import { type Payment } from "./payment.entity";

export const PAYMENT_REPOSITORY = Symbol("PAYMENT_REPOSITORY");

export interface RecordPaymentInput {
  orderId: string;
  provider: PaymentProviderCode;
  status: PaymentStatus;
  amountMinor: number;
  currency: Currency;
  providerRef?: string | null;
  /** The gateway's verbatim response, kept for disputes. `null` for a manual activation. */
  rawPayload?: Record<string, unknown> | null;
  occurredAt: Date;
}

/**
 * Written here in step 01, consumed in step 03 (`MANUAL` / `BANK_TRANSFER`) and by whatever
 * gateway adapter eventually arrives. The port exists now so that the manual path and the
 * gateway path record money identically rather than converging later.
 */
export interface PaymentRepository {
  record(tx: Tx, input: RecordPaymentInput): Promise<Payment>;

  findForOrder(orderId: string, tx?: Tx): Promise<Payment[]>;
}
