import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { type PublicPublication, type RecordViewResponse, slugParamSchema } from "@repo/contracts";

import { GetPublicPublicationUseCase } from "../application/get-public-publication.use-case";
import { Public } from "../../../common/decorators/public.decorator";
import { RequestContext } from "../../../common/context/request-context";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

/**
 * The unauthenticated surface. Two routes, both `@Public()`.
 *
 * Everything here crosses the authentication boundary, so the response shape is a deliberate
 * allow-list built by an explicit `select` in the repository — not a filtered entity. A field can only
 * become public by someone adding it here on purpose.
 */
@Controller("public/publications")
export class PublicPublicationsController {
  constructor(private readonly publications: GetPublicPublicationUseCase) {}

  /**
   * Returns 404 for every failure mode — no such slug, unpublished, term expired, project deleted.
   * A visitor must not be able to learn that a portfolio *used to* live at an address, which is why
   * this is 404 and not 410 Gone.
   */
  @Public()
  @Get(":slug")
  async get(@Param(zodPipe(slugParamSchema)) params: { slug: string }): Promise<PublicPublication> {
    const publication = await this.publications.execute(params.slug);

    return {
      slug: publication.slug,
      title: publication.title,
      categoryCode: publication.categoryCode,
      data: publication.data,
      schemaVersion: publication.schemaVersion,
      publishedAt: publication.publishedAt.toISOString(),
      ownerName: publication.ownerName,
    };
  }

  /**
   * Body-less: everything recorded is derived server-side from the request. A client cannot supply an
   * IP, a referrer or a timestamp, so a view count cannot be poisoned with fabricated origins.
   */
  @Public()
  @Post(":slug/views")
  @HttpCode(202)
  async recordView(
    @Param(zodPipe(slugParamSchema)) params: { slug: string },
  ): Promise<RecordViewResponse> {
    const { ip, userAgent } = RequestContext.get();

    // Returns 202 whether or not the slug existed, and never throws: a tracking pixel must not tell a
    // caller which slugs are real, and must never fail the page it is tracking.
    const recorded = await this.publications.recordView(params.slug, {
      ip,
      userAgent,
    });

    return { recorded };
  }
}
