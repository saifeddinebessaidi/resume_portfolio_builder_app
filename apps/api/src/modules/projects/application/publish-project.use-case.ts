import { Inject, Injectable } from "@nestjs/common";
import { EntitlementKey, isReservedSlug } from "@repo/contracts";
import { randomBytes } from "node:crypto";

import { CLOCK, type Clock } from "../../../common/clock/clock";
import { ConsumeEntitlementService } from "../../subscriptions/application/consume-entitlement.service";
import {
  CustomSlugNotAllowedError,
  NoActiveSubscriptionError,
  NotFoundError,
  PublicationLimitReachedError,
  SlugTakenError,
  ValidationFailedError,
} from "../../../common/errors/errors";
import {
  PROJECT_REPOSITORY,
  PUBLICATION_REPOSITORY,
  type ProjectRepository,
} from "../domain/project.repository";
import { type PublicationRepository } from "../domain/publication.repository";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from "../../subscriptions/domain/subscription.repository";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";
import {
  fallbackSlug,
  isUsableSlug,
  slugify,
  type Publication,
} from "../domain/publication.entity";

export interface PublishCommand {
  actorUserId: string;
  projectId: string;
  slug?: string | undefined;
  isPublic: boolean;
}

@Injectable()
export class PublishProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(PUBLICATION_REPOSITORY) private readonly publications: PublicationRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly consume: ConsumeEntitlementService,
  ) {}

  async execute(command: PublishCommand): Promise<Publication> {
    const now = this.clock.now();

    const project = await this.projects.findByIdForOwner(command.projectId, command.actorUserId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    const subscription = await this.subs.findActiveFor(
      command.actorUserId,
      project.categoryCode,
      now,
    );
    if (!subscription) throw new NoActiveSubscriptionError(project.categoryCode);

    // Already published: this is an update, not a new slot.
    const existing = await this.publications.findForProject(project.id);
    if (existing) {
      return this.publications.update(existing.id, {
        isPublic: command.isPublic,
        unpublishedAt: command.isPublic ? null : now,
      });
    }

    /**
     * A custom slug requires the `CUSTOM_SLUG` entitlement — a boolean flag expressed as a limit, so
     * the engine treats "limit >= 1" as allowed and one lookup mechanism covers both flags and counts.
     */
    let slug: string;
    if (command.slug) {
      const custom = await this.consume.limitFor(subscription, EntitlementKey.CUSTOM_SLUG);
      if (!custom || custom.limit === 0) throw new CustomSlugNotAllowedError();

      slug = slugify(command.slug);

      if (!isUsableSlug(slug)) {
        throw new ValidationFailedError([
          {
            path: "slug",
            message: isReservedSlug(slug)
              ? "Ce lien est réservé par l'application."
              : "Ce lien est trop court ou invalide.",
          },
        ]);
      }

      if (await this.publications.slugExists(slug)) throw new SlugTakenError(slug);
    } else {
      slug = await this.generateSlug(project.title);
    }

    /**
     * `PUBLICATION_SLOT` is period-metered (`TERM`), so it goes through `consume` inside the
     * transaction — the same increment-then-verify path as project creation. The pre-check below only
     * produces a better error message; the counter is the gate.
     */
    const slot = await this.consume.limitFor(subscription, EntitlementKey.PUBLICATION_SLOT);
    if (!slot || slot.limit === 0) throw new PublicationLimitReachedError(0, 0);

    /**
     * `expiresAt` is computed **server-side from the plan**, never accepted from the client. This is
     * what turns "Hosting inclus (6 mois)" from a marketing line into an enforced promise.
     */
    const hosting = await this.consume.limitFor(subscription, EntitlementKey.HOSTING_DAYS);
    const expiresAt = this.expiryFrom(now, hosting?.limit ?? null);

    // Resolved outside the transaction — same connection-pool reason as CreateProjectUseCase.
    const slotDefinition = await this.consume.resolve(
      subscription,
      EntitlementKey.PUBLICATION_SLOT,
    );

    return this.uow.run(async (tx) => {
      await this.consume.consumeResolved(tx, {
        subscription,
        key: EntitlementKey.PUBLICATION_SLOT,
        definition: slotDefinition,
        now,
      });

      return this.publications.create(tx, {
        projectId: project.id,
        slug,
        isPublic: command.isPublic,
        expiresAt,
      });
    });
  }

  private expiryFrom(now: Date, hostingDays: number | null): Date | null {
    // null = the plan grants unlimited hosting; a CV plan grants none at all, and a project in a
    // category with no HOSTING_DAYS row simply never expires rather than expiring immediately.
    if (hostingDays === null || hostingDays <= 0) return null;

    const expires = new Date(now);
    expires.setUTCDate(expires.getUTCDate() + hostingDays);
    return expires;
  }

  /**
   * Derives a slug from the title, then suffixes on collision.
   *
   * Bounded retries with random suffixes rather than a counter: a counter would leak how many
   * portfolios share a title, and would need a read-modify-write that races.
   */
  private async generateSlug(title: string): Promise<string> {
    const base = slugify(title);
    const seed = isUsableSlug(base) ? base : fallbackSlug(randomBytes(6).toString("hex"));

    if (!(await this.publications.slugExists(seed))) return seed;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${seed}-${randomBytes(2).toString("hex")}`;
      if (!(await this.publications.slugExists(candidate))) return candidate;
    }

    // Six random bytes is 2^48 possibilities; five collisions in a row means something is wrong
    // rather than unlucky, and failing loudly beats looping forever.
    throw new SlugTakenError(seed);
  }
}

@Injectable()
export class UnpublishProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(PUBLICATION_REPOSITORY) private readonly publications: PublicationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Sets `isPublic: false` rather than deleting the row, so the owner keeps their slug. Deleting
   * would free the slug for someone else to claim, which is a nasty surprise for anyone who has
   * shared the link.
   */
  async execute(userId: string, projectId: string): Promise<void> {
    const project = await this.projects.findByIdForOwner(projectId, userId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    const publication = await this.publications.findForProject(project.id);
    if (!publication) throw new NotFoundError("Ce projet n'est pas publié.");

    await this.publications.update(publication.id, {
      isPublic: false,
      unpublishedAt: this.clock.now(),
    });
  }
}
