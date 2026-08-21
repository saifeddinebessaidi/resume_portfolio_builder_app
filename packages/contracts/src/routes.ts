import { type CategoryCode } from "./enums/category";

/** Mounted in main.ts. Exported so the web client builds the base URL from one place. */
export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

/**
 * Every path the API serves, as builders.
 *
 * No hand-written URL string anywhere in apps/web. Renaming a path is then a compile error at
 * every call site instead of a 404 discovered in the browser.
 *
 * Paths are relative to API_PREFIX, except `health` which is deliberately mounted outside the
 * version prefix so a platform probe survives a version bump.
 */
export const ROUTES = {
  health: () => "/health",

  me: () => "/me",

  catalog: {
    categories: () => "/catalog/categories",
    plans: (code: CategoryCode) => `/catalog/categories/${code}/plans`,
  },

  dashboard: {
    summary: () => "/dashboard/summary",
  },

  subscriptions: {
    list: () => "/subscriptions",
    entitlements: () => "/subscriptions/entitlements",
  },

  projects: {
    list: () => "/projects",
    create: () => "/projects",
    detail: (id: string) => `/projects/${id}`,
    versions: (id: string) => `/projects/${id}/versions`,
    version: (id: string, versionNumber: number) => `/projects/${id}/versions/${versionNumber}`,
    exports: (id: string) => `/projects/${id}/exports`,
    publication: (id: string) => `/projects/${id}/publication`,
    assets: (id: string) => `/projects/${id}/assets`,
    /**
     * Generates the portfolio's written copy. Scoped under the project because generation reads that
     * project's payload and is authorised by owning it — there is no "generate from arbitrary input"
     * endpoint, which is what stops it being an open proxy to a billable model.
     */
    portfolioContent: (id: string) => `/projects/${id}/portfolio-content`,
  },

  public: {
    publication: (slug: string) => `/public/publications/${slug}`,
    publicationViews: (slug: string) => `/public/publications/${slug}/views`,
  },

  orders: {
    list: () => "/orders",
    create: () => "/orders",
    detail: (id: string) => `/orders/${id}`,
    pay: (id: string) => `/orders/${id}/pay`,
    cancel: (id: string) => `/orders/${id}/cancel`,
  },

  billing: {
    webhook: (provider: string) => `/billing/webhooks/${provider}`,
  },

  uploads: {
    /**
     * Short-lived Cloudinary signature. Authenticated: an open signer is an open write to storage.
     *
     * `kind` picks the folder and the resource endpoint, and is resolved server-side — omitted means
     * `image`, so every existing CV-photo call site is unchanged.
     */
    signature: (kind?: "image" | "video") =>
      kind ? `/uploads/signature?kind=${kind}` : "/uploads/signature",
  },

  events: () => "/events",

  admin: {
    users: () => "/admin/users",
    user: (id: string) => `/admin/users/${id}`,
    grantSubscription: () => "/admin/subscriptions/grant",
    metricsOverview: () => "/admin/metrics/overview",
    metricsSeries: () => "/admin/metrics/series",
    auditLogs: () => "/admin/audit-logs",
  },
} as const;

/**
 * Appends a query string, dropping `undefined` and `null` so an optional filter that was not
 * supplied does not become the literal string "undefined" in the URL — a bug that produces a
 * confusing 422 rather than an obvious failure.
 */
export function withQuery(
  path: string,
  query: Record<string, string | number | boolean | null | undefined> = {},
): string {
  // Hand-rolled rather than URLSearchParams: this package ships to both the browser and the
  // Node API, and URLSearchParams' types come from either the DOM lib or @types/node. Adding
  // either would make one side depend on the other's environment. encodeURIComponent is a
  // plain ES built-in.
  const pairs: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }

  return pairs.length > 0 ? `${path}?${pairs.join("&")}` : path;
}

/** Absolute public link for a publication, used to render `publicUrl` in responses. */
export const publicUrlFor = (appUrl: string, slug: string): string =>
  `${appUrl.replace(/\/$/, "")}/p/${slug}`;
