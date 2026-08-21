import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { AppConfigService } from "../../../config/app-config.service";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { NotFoundError } from "../../../common/errors/errors";
import { PUBLICATION_REPOSITORY } from "../domain/project.repository";
import {
  type PublicPublicationView,
  type PublicationRepository,
} from "../domain/publication.repository";

/**
 * The unauthenticated read path.
 *
 * Every failure mode returns the same `404`: not published, term expired, project soft-deleted, or no
 * such slug. A visitor must not be able to learn that a portfolio *used to* exist at an address —
 * which is why this is 404 and not 410 Gone.
 */
@Injectable()
export class GetPublicPublicationUseCase {
  constructor(
    @Inject(PUBLICATION_REPOSITORY) private readonly publications: PublicationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: AppConfigService,
  ) {}

  async execute(slug: string): Promise<PublicPublicationView> {
    // All four predicates live in the query, so expiry is enforced by the read itself rather than by
    // a cron that might not have run.
    const publication = await this.publications.findLiveBySlug(slug, this.clock.now());
    if (!publication) throw new NotFoundError("Cette page est introuvable.");

    return publication;
  }

  /**
   * Records a view. Never throws to the caller: a failed analytics write must not break a public page.
   *
   * The IP is salted and hashed, never stored raw. `APP_IP_SALT` is required to be 32+ characters
   * because a short salt makes the hash reversible by brute force over the IPv4 space, which would
   * defeat the point entirely.
   */
  async recordView(
    slug: string,
    visitor: {
      ip?: string | undefined;
      userAgent?: string | undefined;
      referrer?: string | undefined;
    },
  ): Promise<boolean> {
    try {
      const ipHash = visitor.ip
        ? createHash("sha256").update(`${this.config.ipSalt}:${visitor.ip}`).digest("hex")
        : null;

      return await this.publications.recordView(slug, {
        ipHash,
        userAgent: visitor.userAgent ?? null,
        referrer: visitor.referrer ?? null,
      });
    } catch {
      return false;
    }
  }
}
