import { Controller, Get, Inject } from "@nestjs/common";
import {
  CATEGORY_CODES,
  CATEGORY_SLUGS,
  DASHBOARD_PROJECTS_PER_CATEGORY,
  type DashboardCategory,
  type DashboardSummary,
  publicUrlFor,
} from "@repo/contracts";

import { AppConfigService } from "../../config/app-config.service";
import { CATALOG_REPOSITORY, type CatalogRepository } from "../catalog/domain/catalog.repository";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PROJECT_REPOSITORY, type ProjectRepository } from "../projects/domain/project.repository";
import {
  ProjectQuotaResolver,
  type ProjectQuota,
} from "../projects/application/read-projects.use-cases";
import { PUBLICATION_REPOSITORY } from "../projects/domain/project.repository";
import { type PublicationRepository } from "../projects/domain/publication.repository";
import { ResolveEntitlementsUseCase } from "../subscriptions/application/resolve-entitlements.use-case";
import { toResolvedEntitlementResponse } from "../subscriptions/presentation/subscriptions.controller";
import { type User } from "../users/domain/user.entity";

/**
 * `GET /dashboard/summary` — **the entire home screen in one round trip.**
 *
 * Three tables, three quota badges and three CTAs all render from this one response, so the dashboard
 * has no request waterfall and no per-category N+1. That is the whole reason this endpoint exists
 * instead of the client calling `/subscriptions/entitlements` plus `/projects?category=…` three times.
 *
 * `canCreate` and `blockedReason` are computed **server-side**. The client must never re-derive
 * "is this user allowed to create" from the raw numbers — that logic would then live in two places
 * and drift, and the UI would enable a button the API rejects.
 */
@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly resolve: ResolveEntitlementsUseCase,
    private readonly quota: ProjectQuotaResolver,
    private readonly config: AppConfigService,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(PUBLICATION_REPOSITORY) private readonly publications: PublicationRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
  ) {}

  @Get("summary")
  async summary(@CurrentUser() user: User): Promise<DashboardSummary> {
    // The catalog read is cached, and entitlements resolve per category in one pass.
    const [categories, entitlementStates] = await Promise.all([
      this.catalog.findCategories(),
      this.resolve.executeAll(user.id, [...CATEGORY_CODES]),
    ]);

    const blocks = await Promise.all(
      CATEGORY_CODES.map(async (code): Promise<DashboardCategory> => {
        const category = categories.find((c) => c.code === code);
        const state = entitlementStates.get(code);

        const recent = await this.projects.findRecentForOwner(
          user.id,
          code,
          DASHBOARD_PROJECTS_PER_CATEGORY,
        );

        // The total is a separate count so the table can say "2 projets" without the client
        // inferring it from a capped list of 5.
        const total = await this.projects.countForOwner(user.id, code);
        const quotas = await this.quota.resolveMany(user.id, recent);

        const items = await Promise.all(
          recent.map(async (project) => {
            const q: ProjectQuota = quotas.get(project.id) ?? {
              revisionLimit: null,
              exportLimit: null,
              exportCount: 0,
              completionPercent: 0,
            };
            const publication = await this.publications.findForProject(project.id);

            return {
              id: project.id,
              categoryCode: project.categoryCode,
              title: project.title,
              status: project.status,
              revisionCount: project.revisionCount,
              revisionLimit: q.revisionLimit,
              exportCount: q.exportCount,
              exportLimit: q.exportLimit,
              completionPercent: q.completionPercent,
              publicUrl: publication?.isPublic
                ? publicUrlFor(this.config.appPublicUrl, publication.slug)
                : null,
              createdAt: project.createdAt.toISOString(),
              updatedAt: project.updatedAt.toISOString(),
            };
          }),
        );

        return {
          code,
          // The category row should always exist (the seed writes all three), but an inactive or
          // missing one must not blank the dashboard — fall back to the static slug and the code.
          name: category?.name ?? code,
          slug: category?.slug ?? CATEGORY_SLUGS[code],
          subscription: state?.subscription
            ? {
                status: state.subscription.status,
                planCode: state.subscription.planCodeSnapshot,
                // The catalog's display name ("6 Mois"), falling back to the code only when the plan row
                // is gone — a customer should never be shown "RESUME_6M".
                planName: state.planName ?? state.subscription.planCodeSnapshot,
                endsAt: state.subscription.endsAt.toISOString(),
              }
            : null,
          entitlements: (state?.entitlements ?? []).map(toResolvedEntitlementResponse),
          canCreate: state?.canCreate ?? false,
          /**
           * `state.blockedReason` is legitimately `null` when creation is allowed, and `??` treats
           * null as "missing" — which reported `canCreate: true` alongside
           * `blockedReason: NO_ACTIVE_SUBSCRIPTION` on every unblocked category. Only a genuinely
           * absent `state` gets the default.
           */
          blockedReason: state ? state.blockedReason : "NO_ACTIVE_SUBSCRIPTION",
          projects: { total, items },
        };
      }),
    );

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      // Iterated in CATEGORY_CODES order, not the database's: the three dashboard tables must appear
      // in the same order on every load, and a `sortOrder` edit should not silently reshuffle the UI.
      categories: blocks,
    };
  }
}
