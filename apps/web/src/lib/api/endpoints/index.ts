import {
  ROUTES,
  type CategoriesResponse,
  type CategoryCode,
  type DashboardSummary,
  type EntitlementsResponse,
  type ListProjectsQuery,
  type ListProjectsResponse,
  type MeResponse,
  type PlansResponse,
  type ProjectDetail,
  type SubscriptionsResponse,
  type UpdateMeRequest,
  categoriesResponseSchema,
  dashboardSummarySchema,
  entitlementsResponseSchema,
  listProjectsResponseSchema,
  meResponseSchema,
  plansResponseSchema,
  projectDetailSchema,
  subscriptionsResponseSchema,
  withQuery,
  uploadSignatureSchema,
  type UploadSignature,
  type UploadKind,
  publicationSchema,
  type Publication,
  type PublishRequest,
  publicPublicationSchema,
  type PublicPublication,
  generatedPortfolioContentSchema,
  generatedResumeSummarySchema,
  type GeneratedPortfolioContent,
  type GeneratedResumeSummary,
  type GeneratePortfolioContentRequest,
} from "@repo/contracts";

import { request } from "../client";

/**
 * Thin per-resource wrappers.
 *
 * **No URL string is written by hand** — every path comes from `ROUTES`, so renaming an endpoint is a
 * compile error at every call site instead of a 404 discovered in the browser.
 */
export const meApi = {
  get: (signal?: AbortSignal) =>
    request({ path: ROUTES.me(), schema: meResponseSchema, ...(signal ? { signal } : {}) }),

  update: (body: UpdateMeRequest) =>
    request({ path: ROUTES.me(), method: "PATCH", body, schema: meResponseSchema }),
} satisfies Record<string, (...args: never[]) => Promise<MeResponse>>;

export const catalogApi = {
  categories: (signal?: AbortSignal): Promise<CategoriesResponse> =>
    request({
      path: ROUTES.catalog.categories(),
      schema: categoriesResponseSchema,
      ...(signal ? { signal } : {}),
    }),

  plans: (code: CategoryCode, signal?: AbortSignal): Promise<PlansResponse> =>
    request({
      path: ROUTES.catalog.plans(code),
      schema: plansResponseSchema,
      ...(signal ? { signal } : {}),
    }),
};

export const dashboardApi = {
  /** The whole home screen in one call. */
  summary: (signal?: AbortSignal): Promise<DashboardSummary> =>
    request({
      path: ROUTES.dashboard.summary(),
      schema: dashboardSummarySchema,
      ...(signal ? { signal } : {}),
    }),
};

export const subscriptionsApi = {
  list: (signal?: AbortSignal): Promise<SubscriptionsResponse> =>
    request({
      path: ROUTES.subscriptions.list(),
      schema: subscriptionsResponseSchema,
      ...(signal ? { signal } : {}),
    }),

  entitlements: (signal?: AbortSignal): Promise<EntitlementsResponse> =>
    request({
      path: ROUTES.subscriptions.entitlements(),
      schema: entitlementsResponseSchema,
      ...(signal ? { signal } : {}),
    }),
};

/**
 * The unauthenticated surface — what a visitor with only a link can read.
 *
 * Separate from `projectsApi` on purpose. Every other wrapper here rides a bearer token; these two do
 * not, and keeping them in their own object makes it obvious at the call site that the response has
 * crossed the auth boundary and contains only the API's explicit allow-list.
 */
export const publicApi = {
  /** 404 for every failure — no such slug, unpublished, hosting expired, project deleted. */
  publication: (slug: string, signal?: AbortSignal): Promise<PublicPublication> =>
    request({
      path: ROUTES.public.publication(slug),
      schema: publicPublicationSchema,
      ...(signal ? { signal } : {}),
    }),
};

export const uploadsApi = {
  /** The short-lived Cloudinary signature. Read through the server proxy, never from the browser. */
  signature: (kind?: UploadKind): Promise<UploadSignature> =>
    request({ path: ROUTES.uploads.signature(kind), schema: uploadSignatureSchema }),
};

export const projectsApi = {
  list: (
    query: Partial<ListProjectsQuery> = {},
    signal?: AbortSignal,
  ): Promise<ListProjectsResponse> =>
    request({
      path: withQuery(ROUTES.projects.list(), {
        category: query.category ?? null,
        status: query.status ?? null,
        cursor: query.cursor ?? null,
        limit: query.limit ?? null,
      }),
      schema: listProjectsResponseSchema,
      ...(signal ? { signal } : {}),
    }),

  detail: (id: string, signal?: AbortSignal): Promise<ProjectDetail> =>
    request({
      path: ROUTES.projects.detail(id),
      schema: projectDetailSchema,
      ...(signal ? { signal } : {}),
    }),

  /**
   * Publishes a project and returns its public link.
   *
   * The **slug is generated server-side** when none is supplied — from the project title, deduplicated
   * against the unique index, and checked against the reserved list. That is deliberate: a slug the
   * client invents could collide, shadow an app route, or bypass the `CUSTOM_SLUG` entitlement, and all
   * three are decided by rules the API owns.
   */
  publish: (id: string, body: PublishRequest = { isPublic: true }): Promise<Publication> =>
    request({
      path: ROUTES.projects.publication(id),
      method: "POST",
      body,
      schema: publicationSchema,
    }),

  /**
   * Generates the portfolio's written copy and returns it — writing nothing.
   *
   * The caller puts the text in the form and the ordinary autosave stores it, so a generation costs no
   * revision and one the user dislikes is discarded by not saving.
   */
  generatePortfolioContent: (
    id: string,
    body: GeneratePortfolioContentRequest = { replaceExisting: false },
  ): Promise<GeneratedPortfolioContent> =>
    request({
      path: ROUTES.projects.portfolioContent(id),
      method: "POST",
      body,
      schema: generatedPortfolioContentSchema,
    }),

  /**
   * Generates the CV's « Profil » paragraph and returns it — writing nothing, like the portfolio one.
   *
   * The endpoint reads no body: a Profil is generated once per CV, so there is no "yes, overwrite" for
   * the caller to record.
   *
   * **`body: {}` is sent anyway, and it is not decorative.** `request` sets `content-type:
   * application/json` on every call, and omits the body only when `body` is `undefined` — and Fastify
   * rejects that exact pairing with `400 FST_ERR_CTP_EMPTY_JSON_BODY`, "Body cannot be empty when
   * content-type is set to 'application/json'". So a POST with nothing to say still has to say `{}`.
   *
   * Worth recording how this got shipped: it was tested with `curl`, which sent no `content-type` at
   * all, so Fastify never attempted to parse and the call returned 200. The browser sets the header on
   * every request and got a 400 for the same endpoint. A test that omits a header the real client
   * always sends is not testing the real client.
   *
   * The deeper fix is for `request` not to announce a content type it is not sending, but that changes
   * every call in the app; this keeps the blast radius at one endpoint.
   */
  generateResumeSummary: (id: string): Promise<GeneratedResumeSummary> =>
    request({
      path: ROUTES.projects.resumeSummary(id),
      method: "POST",
      body: {},
      schema: generatedResumeSummarySchema,
    }),

  create: (body: { categoryCode: CategoryCode; title?: string; data?: Record<string, unknown> }) =>
    request({
      path: ROUTES.projects.create(),
      method: "POST",
      body,
      schema: projectDetailSchema,
    }),

  update: (id: string, body: Record<string, unknown>) =>
    request({
      path: ROUTES.projects.detail(id),
      method: "PATCH",
      body,
      schema: projectDetailSchema,
    }),

  remove: (id: string) => request<void>({ path: ROUTES.projects.detail(id), method: "DELETE" }),
};
