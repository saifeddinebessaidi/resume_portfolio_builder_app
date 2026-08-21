/**
 * The port every text generation goes through.
 *
 * Deliberately **not** shaped like a chat API. No `messages` array, no `role`, no `temperature`, no
 * token budget — those are one vendor's transport, and putting them in the port would make every use case
 * depend on the shape of an HTTP body. What a use case actually needs is "here is an instruction and some
 * facts, give me back an object of this shape", and that is all this exposes.
 *
 * That is what makes swapping Groq for OpenAI, or for Anthropic — whose API is *not* OpenAI-compatible —
 * an adapter change with no use case touched. The `AI_PROVIDER` values include `claude` and `gemini` for
 * exactly that reason; only `groq`/`openai` are wired today, and the adapter says so.
 *
 * ## No `@nestjs/*` import
 *
 * This file is in `domain/`, so the eslint zone rules forbid it — the token below is a plain `Symbol`
 * rather than an `InjectionToken`. The wiring that binds it lives in `presentation/`.
 */

/** DI token. A symbol, not a string, so two modules cannot collide on the same name. */
export const TEXT_GENERATOR = Symbol("TEXT_GENERATOR");

export interface GenerateJsonRequest {
  /** Who the model is and what register to write in. Stable across calls; never user-controlled. */
  system: string;
  /** The facts to write from. Assembled by the use case from the stored payload, never free-form input. */
  user: string;
  /**
   * A hint for the maximum reply size. The adapter is free to add its own headroom — reasoning models
   * spend part of their budget before emitting a single visible character, and a limit set to the
   * *visible* length produces an empty response with `finish_reason: "length"`.
   */
  maxOutputTokens: number;
}

/**
 * Thrown when generation cannot produce a usable result: not configured, the provider refused, the call
 * timed out, or the reply was not the JSON that was asked for.
 *
 * One error type rather than four, because every one of them means the same thing to a caller — no text
 * this time, try again — and the distinction that matters (was it *our* fault) is carried by `retryable`.
 */
export class TextGenerationError extends Error {
  constructor(
    message: string,
    /** False for "not configured" and for a refusal; true for a timeout or a transient provider error. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TextGenerationError";
  }
}

export interface TextGenerator {
  /**
   * Returns the parsed JSON object the model produced.
   *
   * Typed `Record<string, unknown>` rather than a generic: the *caller* validates with its own Zod schema,
   * which is the only place that knows what shape it asked for. A generic here would hand back a lie —
   * a compile-time type over data no one checked.
   */
  generateJson(request: GenerateJsonRequest): Promise<Record<string, unknown>>;

  /** False when no key is configured, so a caller can refuse early with a clear reason. */
  isConfigured(): boolean;
}
