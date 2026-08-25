import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common";
import {
  generatePortfolioContentRequestSchema,
  projectIdParamSchema,
  type GeneratePortfolioContentRequest,
  type GeneratedPortfolioContent,
  type GeneratedResumeSummary,
} from "@repo/contracts";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { GeneratePortfolioContentUseCase } from "../application/generate-portfolio-content.use-case";
import { GenerateResumeSummaryUseCase } from "../application/generate-resume-summary.use-case";
import { InternalError, RateLimitedError } from "../../../common/errors/errors";
import { TextGenerationError } from "../domain/text-generator.port";
import { type User } from "../../users/domain/user.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

/**
 * `POST /projects/:id/portfolio-content`.
 *
 * Authenticated like every other project route — the global guard applies, and the use case scopes the
 * lookup to the caller. There is no `@Public()` here and there must never be: this endpoint spends money
 * on every call, so an unauthenticated one is an invitation to spend all of it.
 *
 * ## 200, not 201
 *
 * Nothing is created. The generated text is returned for the client to put in the form; the ordinary
 * autosave persists it. A `201` would imply a resource exists at some URL, and none does.
 *
 * ## Mapping a generation failure onto a status
 *
 * `TextGenerationError.retryable` is what decides. A timeout or a provider 5xx becomes `429` with a
 * retry hint — the user should press the button again. "Not configured" is ours, so it becomes a `500`
 * whose detail the exception filter genericises, with the real reason already in the log. Neither leaks
 * the provider's own message, which can name the model, the account, or quota specifics.
 */
@Controller("projects")
export class GenerationController {
  constructor(
    private readonly generate: GeneratePortfolioContentUseCase,
    private readonly generateSummary: GenerateResumeSummaryUseCase,
  ) {}

  @Post(":id/portfolio-content")
  @HttpCode(200)
  async portfolioContent(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
    /**
     * The body is parsed even though the use case ignores `replaceExisting` today: it is the client's
     * record that the user meant to overwrite existing copy, and validating it now means adding the
     * behaviour later is not a contract change.
     */
    @Body(zodPipe(generatePortfolioContentRequestSchema)) _body: GeneratePortfolioContentRequest,
  ): Promise<GeneratedPortfolioContent> {
    try {
      return await this.generate.execute({ projectId: params.id, userId: user.id });
    } catch (error) {
      throw asHttpError(error);
    }
  }

  /**
   * `POST /projects/:id/resume-summary` — the CV's « Profil » paragraph.
   *
   * **No body.** The portfolio route carries `replaceExisting` because regenerating there is normal and
   * has to be asked for; a Profil is generated once per CV, so there is no second press to record.
   */
  @Post(":id/resume-summary")
  @HttpCode(200)
  async resumeSummary(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
  ): Promise<GeneratedResumeSummary> {
    try {
      return await this.generateSummary.execute({ projectId: params.id, userId: user.id });
    } catch (error) {
      throw asHttpError(error);
    }
  }
}

/**
 * A generation failure as a status, shared by both routes.
 *
 * `retryable` is what decides. A timeout or a provider 5xx becomes `429` with a retry hint — the user
 * should press the button again. "Not configured" is ours, so it becomes a `500` whose detail the
 * exception filter genericises, with the real reason already in the log. Neither leaks the provider's
 * own message, which can name the model, the account, or quota specifics.
 *
 * Anything that is not a `TextGenerationError` — a `NotFoundError`, a `ValidationFailedError`, a Zod
 * failure — is returned untouched for the filter to map, exactly as before.
 */
function asHttpError(error: unknown): unknown {
  if (error instanceof TextGenerationError) {
    if (error.retryable) return new RateLimitedError(5);
    return new InternalError(error.message);
  }
  return error;
}
