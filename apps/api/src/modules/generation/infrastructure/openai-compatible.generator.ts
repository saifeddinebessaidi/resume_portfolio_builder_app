import { Injectable, Logger } from "@nestjs/common";

import { AppConfigService } from "../../../config/app-config.service";
import {
  TextGenerationError,
  type GenerateJsonRequest,
  type TextGenerator,
} from "../domain/text-generator.port";

/**
 * One adapter for every provider that speaks OpenAI's `/chat/completions` — which is Groq today and
 * OpenAI when the key changes, with no code change between them.
 *
 * ## Everything here was verified against the live Groq account, not assumed
 *
 * Three things went wrong on the way and each is now handled:
 *
 * 1. **`llama-3.3-70b-versatile` is retired.** `GET /models` on the supplied key lists
 *    `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.6-27b`, the `groq/compound` pair, plus
 *    Whisper and Arabic models — and no Llama. Naming it fails. `AI_MODEL` therefore defaults to
 *    `openai/gpt-oss-120b`.
 *
 * 2. **The available models are reasoning models, and they spend their budget thinking.** With
 *    `max_tokens: 320` every one of them returned `finish_reason: "length"` and an *empty* `content` —
 *    the whole allowance went to reasoning tokens before any visible output. Hence
 *    `reasoning_effort: "low"` and the generous ceiling below. This is the failure mode that looks like
 *    "the model returned nothing" and is actually "the model never got to speak".
 *
 * 3. **`response_format: json_object` is what makes parsing reliable.** Without it `qwen` emitted its
 *    entire chain of thought as prose. With it, `gpt-oss-120b` returns valid JSON in ~440 tokens and
 *    under a second.
 *
 * ## The key never leaves this file's process
 *
 * `AI_API_KEY` is read from config and attached to a server-side request. The browser calls our endpoint
 * and receives text. That is the whole reason this is an API module and not a client-side fetch: a
 * generation credential in the browser is a billable credential in public.
 */
@Injectable()
export class OpenAiCompatibleGenerator implements TextGenerator {
  private readonly logger = new Logger(OpenAiCompatibleGenerator.name);

  constructor(private readonly config: AppConfigService) {}

  isConfigured(): boolean {
    return this.config.ai !== null;
  }

  async generateJson(request: GenerateJsonRequest): Promise<Record<string, unknown>> {
    const ai = this.config.ai;

    if (!ai) {
      // Logged with the reason, and refused as non-retryable: retrying a missing key never helps.
      this.logger.warn("Generation requested but AI_API_KEY is not set.");
      throw new TextGenerationError("La génération n'est pas configurée sur ce serveur.", false);
    }

    /**
     * `AbortSignal.timeout` rather than a `Promise.race`: this actually cancels the socket. A race
     * leaves the request running and its response to be discarded, which still costs the tokens.
     */
    const signal = AbortSignal.timeout(ai.timeoutMs);
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(`${ai.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ai.apiKey}`,
        },
        signal,
        body: JSON.stringify({
          model: ai.model,
          /**
           * Some warmth: this is marketing copy for a creative professional, and a deterministic
           * setting makes every portfolio on the platform read like the same person wrote it.
           */
          temperature: 0.7,
          /**
           * `max_completion_tokens`, not the deprecated `max_tokens` — and headroom over the caller's
           * hint, because reasoning tokens are billed against this same ceiling (see note 2 above).
           */
          max_completion_tokens: request.maxOutputTokens + 1_200,
          reasoning_effort: "low",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
        }),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      this.logger.warn(
        `Generation request failed after ${String(Date.now() - startedAt)}ms: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
      throw new TextGenerationError(
        timedOut
          ? "La génération a pris trop de temps. Réessayez."
          : "Le service de génération est injoignable.",
        true,
      );
    }

    if (!response.ok) {
      /**
       * The provider's own message is logged but **not** returned to the user: it can name the model,
       * the account, or quota details, and none of that belongs in a browser response.
       */
      const detail = await response.text().catch(() => "");
      this.logger.warn(
        `Generation provider ${ai.provider} returned ${String(response.status)}: ${detail.slice(0, 400)}`,
      );
      throw new TextGenerationError(
        "Le service de génération a refusé la demande.",
        // 5xx and 429 are worth another attempt; a 400 means the request itself is wrong.
        response.status >= 500 || response.status === 429,
      );
    }

    const body = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: { total_tokens?: number };
    } | null;

    const choice = body?.choices?.[0];
    const content = choice?.message?.content;

    /**
     * An empty `content` with `finish_reason: "length"` is the reasoning-budget exhaustion described
     * above. Called out separately because the generic "invalid reply" message would send someone
     * looking in entirely the wrong place.
     */
    if (!content?.trim()) {
      this.logger.warn(
        `Generation returned no content (finish_reason=${choice?.finish_reason ?? "none"}). ` +
          "If this is 'length', the reasoning budget was spent before any visible output.",
      );
      throw new TextGenerationError("La génération n'a rien renvoyé. Réessayez.", true);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      this.logger.warn(
        `Generation returned non-JSON despite json_object mode: ${content.slice(0, 200)}`,
      );
      throw new TextGenerationError("La génération a renvoyé une réponse inattendue.", true);
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new TextGenerationError("La génération a renvoyé une réponse inattendue.", true);
    }

    this.logger.log(
      `Generated with ${ai.provider}/${ai.model} in ${String(Date.now() - startedAt)}ms ` +
        `(${String(body?.usage?.total_tokens ?? 0)} tokens)`,
    );

    return parsed as Record<string, unknown>;
  }
}
