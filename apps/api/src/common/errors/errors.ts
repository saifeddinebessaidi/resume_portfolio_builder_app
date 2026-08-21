import {
  type CategoryCode,
  type EntitlementKey,
  type ErrorCode,
  type ValidationIssue,
} from "@repo/contracts";

import { DomainError } from "./domain-error";

/**
 * Concrete business failures. One class per code that a use case can actually throw.
 *
 * The `detail` messages are French because they are shown to the user, and they embed the
 * numbers so a user with no console still gets a useful message. The same numbers are repeated
 * in `meta` for the UI to format itself.
 */

// --- Authentication and authorization ------------------------------------------------

export class UnauthenticatedError extends DomainError {
  readonly code: ErrorCode = "UNAUTHENTICATED";

  constructor(reason = "Aucun jeton d'authentification n'a été fourni.") {
    super(reason);
  }
}

export class TokenInvalidError extends DomainError {
  readonly code: ErrorCode = "TOKEN_INVALID";

  /**
   * `reason` is for the logs only. The filter sends `detail`, which stays generic: telling a
   * caller whether a token failed on its signature, its issuer or its expiry is an oracle for
   * anyone probing the auth layer.
   */
  constructor(readonly reason: string) {
    super("Votre session est invalide ou a expiré. Veuillez vous reconnecter.");
  }
}

export class AccountSuspendedError extends DomainError {
  readonly code: ErrorCode = "ACCOUNT_SUSPENDED";

  constructor() {
    super("Votre compte est suspendu. Contactez le support.");
  }
}

export class ForbiddenError extends DomainError {
  readonly code: ErrorCode = "FORBIDDEN";

  constructor(detail = "Vous n'avez pas les droits nécessaires pour cette action.") {
    super(detail);
  }
}

/**
 * Used for a genuinely missing resource **and** for another user's resource.
 *
 * Deliberately indistinguishable: returning 403 for someone else's project confirms that a
 * project with that id exists, which leaks information across accounts. The repository simply
 * never finds it.
 */
export class NotFoundError extends DomainError {
  readonly code: ErrorCode = "NOT_FOUND";

  constructor(what = "La ressource demandée est introuvable.") {
    super(what);
  }
}

// --- Validation ----------------------------------------------------------------------

export class ValidationFailedError extends DomainError {
  readonly code: ErrorCode = "VALIDATION_FAILED";

  constructor(issues: ValidationIssue[]) {
    super("Certains champs sont invalides.", { issues });
  }
}

// --- Subscription and entitlement ----------------------------------------------------

export class NoActiveSubscriptionError extends DomainError {
  readonly code: ErrorCode = "NO_ACTIVE_SUBSCRIPTION";

  constructor(categoryCode: CategoryCode) {
    super("Vous n'avez pas d'abonnement actif pour cette catégorie.", { categoryCode });
  }
}

export class SubscriptionExpiredError extends DomainError {
  readonly code: ErrorCode = "SUBSCRIPTION_EXPIRED";

  constructor(categoryCode: CategoryCode, endedAt: Date) {
    super("Votre abonnement a expiré. Renouvelez-le pour continuer.", {
      categoryCode,
      endedAt: endedAt.toISOString(),
    });
  }
}

export class DuplicateActiveSubscriptionError extends DomainError {
  readonly code: ErrorCode = "DUPLICATE_ACTIVE_SUBSCRIPTION";

  constructor(categoryCode: CategoryCode) {
    super("Un abonnement actif existe déjà pour cette catégorie.", { categoryCode });
  }
}

export class PlanInactiveError extends DomainError {
  readonly code: ErrorCode = "PLAN_INACTIVE";

  constructor(planCode: string) {
    super("Cette offre n'est plus disponible.", { planCode });
  }
}

export class EntitlementExhaustedError extends DomainError {
  readonly code: ErrorCode = "ENTITLEMENT_EXHAUSTED";

  constructor(
    key: EntitlementKey,
    limit: number,
    used: number,
    resetsAt: Date | null,
    categoryCode?: CategoryCode,
  ) {
    super(`Vous avez utilisé ${used} sur ${limit} de votre quota inclus.`, {
      entitlementKey: key,
      limit,
      used,
      resetsAt: resetsAt?.toISOString() ?? null,
      ...(categoryCode ? { categoryCode } : {}),
    });
  }
}

export class RevisionLimitReachedError extends DomainError {
  readonly code: ErrorCode = "REVISION_LIMIT_REACHED";

  constructor(limit: number, used: number) {
    super(`Vous avez atteint la limite de ${limit} modification(s) pour ce projet.`, {
      entitlementKey: "REVISION_PER_PROJECT",
      limit,
      used,
      resetsAt: null,
    });
  }
}

export class ExportLimitReachedError extends DomainError {
  readonly code: ErrorCode = "EXPORT_LIMIT_REACHED";

  constructor(limit: number, used: number) {
    super(`Vous avez atteint la limite de ${limit} téléchargement(s) pour ce projet.`, {
      entitlementKey: "EXPORT_PER_PROJECT",
      limit,
      used,
      resetsAt: null,
    });
  }
}

export class PublicationLimitReachedError extends DomainError {
  readonly code: ErrorCode = "PUBLICATION_LIMIT_REACHED";

  constructor(limit: number, used: number) {
    super(`Votre offre permet ${limit} publication(s) et vous en avez ${used}.`, {
      entitlementKey: "PUBLICATION_SLOT",
      limit,
      used,
      resetsAt: null,
    });
  }
}

export class CustomSlugNotAllowedError extends DomainError {
  readonly code: ErrorCode = "CUSTOM_SLUG_NOT_ALLOWED";

  constructor() {
    super("Votre offre n'inclut pas de lien personnalisé.", {
      entitlementKey: "CUSTOM_SLUG",
      limit: 0,
      used: 0,
      resetsAt: null,
    });
  }
}

export class StorageLimitReachedError extends DomainError {
  readonly code: ErrorCode = "STORAGE_LIMIT_REACHED";

  constructor(limitMb: number, usedMb: number) {
    super(`Vous avez utilisé ${usedMb} Mo sur ${limitMb} Mo d'espace inclus.`, {
      entitlementKey: "ASSET_STORAGE_MB",
      limit: limitMb,
      used: usedMb,
      resetsAt: null,
    });
  }
}

// --- Conflicts -----------------------------------------------------------------------

export class SlugTakenError extends DomainError {
  readonly code: ErrorCode = "SLUG_TAKEN";

  constructor(slug: string) {
    super("Ce lien est déjà utilisé. Choisissez-en un autre.", { slug });
  }
}

/**
 * Optimistic concurrency on a *paid, capped* resource. Silently overwriting would cost the
 * user a revision they cannot get back, which is a support ticket rather than an inconvenience.
 */
export class VersionConflictError extends DomainError {
  readonly code: ErrorCode = "VERSION_CONFLICT";

  constructor(expected: number, actual: number) {
    super(
      "Ce projet a été modifié ailleurs. Rechargez la page pour récupérer la dernière version.",
      { expectedVersion: expected, currentVersion: actual },
    );
  }
}

export class OrderNotPayableError extends DomainError {
  readonly code: ErrorCode = "ORDER_NOT_PAYABLE";

  constructor(status: string) {
    super("Cette commande ne peut plus être payée.", { status });
  }
}

export class IdempotencyConflictError extends DomainError {
  readonly code: ErrorCode = "IDEMPOTENCY_CONFLICT";

  constructor(key: string) {
    super("Cette clé d'idempotence a déjà été utilisée avec une requête différente.", { key });
  }
}

// --- Catch-all -----------------------------------------------------------------------

export class RateLimitedError extends DomainError {
  readonly code: ErrorCode = "RATE_LIMITED";

  constructor(retryAfterSeconds: number) {
    super("Trop de requêtes. Réessayez dans un instant.", { retryAfterSeconds });
  }
}

/**
 * For a failure that is genuinely ours. The message stays internal: the filter replaces
 * `detail` with a generic string for any 5xx, so nothing here reaches the client.
 */
export class InternalError extends DomainError {
  readonly code: ErrorCode = "INTERNAL_ERROR";

  constructor(message: string) {
    super(message);
  }
}
