import { type CategoryCode } from "@repo/contracts";

export const CATEGORY_RESOLVER = Symbol("CATEGORY_RESOLVER");

/**
 * "Which category does this project belong to?"
 *
 * A port, deliberately. The entitlement guard needs this to evaluate a mutation on
 * `/projects/:id/*`, but the projects module already depends on the subscriptions module to consume
 * quota. Importing back the other way would make the two mutually dependent and Nest would refuse to
 * resolve them without `forwardRef` — a circular dependency papered over rather than removed.
 *
 * Instead the projects module provides this narrow implementation, and subscriptions depends only on
 * the interface. One method, no project entity, no repository surface.
 */
export interface CategoryResolver {
  /** `null` when the project does not exist or is not visible — the guard then defers to the use case. */
  categoryOfProject(projectId: string): Promise<CategoryCode | null>;
}
