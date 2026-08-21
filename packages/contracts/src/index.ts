/**
 * `@repo/contracts` — the single API typing seam.
 *
 * One declaration per payload, consumed four ways: the API's validation pipe parses requests
 * with it, the API's use cases are typed by `z.infer` of it, the web client's methods are typed
 * by the same inference, and the web forms validate against it. A response shape therefore
 * cannot drift from the code that consumes it, because there is only one declaration to drift
 * from. See ADR-0009.
 *
 * This package ships to the browser. It must never depend on `@prisma/client`, `@nestjs/*`, or
 * anything under `apps/` — enforced by having no such entry in package.json.
 */

// --- Primitives ---
export * from "./primitives/money";
export * from "./primitives/id";
export * from "./primitives/pagination";

// --- Enums (the wire vocabulary; apps/web never imports Prisma's) ---
export * from "./enums/category";
export * from "./enums/billing";
export * from "./enums/entitlement";
export * from "./enums/project";
export * from "./enums/subscription";
export * from "./enums/user";

// --- Errors ---
export * from "./errors/error-codes";
export * from "./errors/problem";

// --- Analytics ---
export * from "./analytics/event-names";

// --- Routes ---
export * from "./routes";

// --- Resources ---
export * from "./resources/user";
export * from "./resources/catalog";
export * from "./resources/subscription";
export * from "./resources/project";
export * from "./resources/publication";
export * from "./resources/order";
export * from "./resources/dashboard";
export * from "./resources/generation";
export * from "./resources/payload";
