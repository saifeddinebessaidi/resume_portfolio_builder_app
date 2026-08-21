import { Module } from "@nestjs/common";

import { GenerationController } from "./generation.controller";
import { GeneratePortfolioContentUseCase } from "../application/generate-portfolio-content.use-case";
import { OpenAiCompatibleGenerator } from "../infrastructure/openai-compatible.generator";
import { ProjectsModule } from "../../projects/presentation/projects.module";
import { TEXT_GENERATOR } from "../domain/text-generator.port";

/**
 * Its own module rather than another route on `ProjectsController`.
 *
 * Generation is an outbound integration with its own credential, its own failure modes and its own
 * provider-swap story; folding it into the projects module would put an HTTP client for a third party
 * next to the code that owns the `Project` aggregate. The dependency runs one way — this module imports
 * `ProjectsModule` for `PROJECT_REPOSITORY`, and nothing in projects knows generation exists.
 *
 * `TEXT_GENERATOR` binds to the OpenAI-compatible adapter, which covers Groq and OpenAI with only
 * `AI_BASE_URL` and `AI_API_KEY` changing. `AI_PROVIDER` also accepts `gemini` and `claude`; neither is
 * wired, and both would be a second adapter bound here rather than a change to any use case — which is
 * the entire point of the port.
 */
@Module({
  imports: [ProjectsModule],
  controllers: [GenerationController],
  providers: [
    GeneratePortfolioContentUseCase,
    { provide: TEXT_GENERATOR, useClass: OpenAiCompatibleGenerator },
  ],
})
export class GenerationModule {}
