import { ERROR_CODES, ERROR_STATUS, type ErrorCode } from "@repo/contracts";

/**
 * The single mapping from a business fact to its HTTP meaning and its user-facing title.
 *
 * This file deliberately imports nothing from `@nestjs/common` — the statuses are plain
 * numbers. That is what lets `application/` throw a domain error without acquiring an opinion
 * about HTTP, and it keeps this table readable as a specification rather than as framework
 * glue.
 *
 * `title` is short, stable and shown to the user. `detail` is per-throw and lives on the error
 * instance, because it carries the specific numbers.
 */
export interface ErrorDefinition {
  httpStatus: number;
  /** French: it reaches the user. Stable across rewording of `detail`. */
  title: string;
}

export const ERROR_CATALOGUE: Record<ErrorCode, ErrorDefinition> = {
  VALIDATION_FAILED: { httpStatus: 422, title: "Données invalides" },
  UNAUTHENTICATED: { httpStatus: 401, title: "Authentification requise" },
  TOKEN_INVALID: { httpStatus: 401, title: "Session invalide" },
  ACCOUNT_SUSPENDED: { httpStatus: 403, title: "Compte suspendu" },
  FORBIDDEN: { httpStatus: 403, title: "Accès refusé" },
  NOT_FOUND: { httpStatus: 404, title: "Ressource introuvable" },

  NO_ACTIVE_SUBSCRIPTION: { httpStatus: 403, title: "Aucun abonnement actif" },
  SUBSCRIPTION_EXPIRED: { httpStatus: 403, title: "Abonnement expiré" },
  ENTITLEMENT_EXHAUSTED: { httpStatus: 403, title: "Quota épuisé" },
  REVISION_LIMIT_REACHED: { httpStatus: 403, title: "Limite de modifications atteinte" },
  EXPORT_LIMIT_REACHED: { httpStatus: 403, title: "Limite de téléchargements atteinte" },
  PUBLICATION_LIMIT_REACHED: { httpStatus: 403, title: "Limite de publications atteinte" },
  CUSTOM_SLUG_NOT_ALLOWED: { httpStatus: 403, title: "Lien personnalisé non inclus" },
  STORAGE_LIMIT_REACHED: { httpStatus: 403, title: "Espace de stockage épuisé" },

  SLUG_TAKEN: { httpStatus: 409, title: "Lien déjà utilisé" },
  VERSION_CONFLICT: { httpStatus: 409, title: "Conflit de version" },
  PLAN_INACTIVE: { httpStatus: 409, title: "Offre indisponible" },
  ORDER_NOT_PAYABLE: { httpStatus: 409, title: "Commande non payable" },
  DUPLICATE_ACTIVE_SUBSCRIPTION: { httpStatus: 409, title: "Abonnement déjà actif" },
  IDEMPOTENCY_CONFLICT: { httpStatus: 409, title: "Requête déjà traitée différemment" },

  RATE_LIMITED: { httpStatus: 429, title: "Trop de requêtes" },
  INTERNAL_ERROR: { httpStatus: 500, title: "Erreur interne" },
};

/**
 * Guards against the catalogue and the contract drifting apart. Runs once at import time
 * because a missing entry would otherwise surface as `undefined.httpStatus` inside an error
 * handler — the worst possible place to discover a configuration gap.
 */
for (const code of ERROR_CODES) {
  const entry = ERROR_CATALOGUE[code];
  if (!entry) {
    throw new Error(`ERROR_CATALOGUE is missing an entry for "${code}".`);
  }
  if (entry.httpStatus !== ERROR_STATUS[code]) {
    throw new Error(
      `ERROR_CATALOGUE disagrees with @repo/contracts on "${code}": ` +
        `${entry.httpStatus} here, ${ERROR_STATUS[code]} in the contract.`,
    );
  }
}

export const definitionFor = (code: ErrorCode): ErrorDefinition => ERROR_CATALOGUE[code];
