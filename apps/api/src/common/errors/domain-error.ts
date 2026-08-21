import { type ErrorCode } from "@repo/contracts";

/**
 * The base class for every business failure.
 *
 * **Carries no HTTP status.** A use case throws a business fact — "this quota is spent" — and
 * exactly one place (AllExceptionsFilter, via ERROR_CATALOGUE) decides what that means over
 * HTTP. That separation is what lets `application/` stay framework-free and unit-testable
 * without a request object.
 *
 * `meta` is not decoration. It is what lets the UI render "Il vous reste 0 CV sur 3 —
 * renouvellement le 1 août" from numbers instead of parsing a French sentence that will be
 * reworded.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;

  readonly meta: Record<string, unknown> | undefined;

  constructor(message: string, meta?: Record<string, unknown>) {
    super(message);
    // Restores the prototype chain across the TypeScript -> ES5 class transpilation boundary,
    // without which `instanceof DomainError` is false for subclasses.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this.meta = meta;
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;
