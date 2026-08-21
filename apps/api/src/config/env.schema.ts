import { z } from "zod";

/**
 * Every environment variable the API reads, validated once at boot.
 *
 * A missing or malformed variable stops the process at second zero with a message naming
 * it, rather than surfacing as a confusing error on the first request hours later.
 */

/**
 * Which identity provider verifies bearer tokens.
 *
 * `local` is a development-only provider: the API signs and verifies its own HS256 tokens
 * so the whole entitlement engine can be exercised before Supabase is wired in. `supabase`
 * verifies Supabase's RS256 tokens against its JWKS and is the production setting.
 * See ADR-0001 and phase 2 step 06.
 */
export const authProviders = ["local", "supabase"] as const;

const nonEmpty = z.string().trim().min(1);

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  /**
   * Comma-separated list of allowed browser origins. Stored as a string in the environment
   * because that is all a platform dashboard can hold; split here, once.
   */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    ),

  /**
   * Prisma needs both: PgBouncer in transaction pooling mode cannot execute DDL, so
   * migrations use the direct connection while the application uses the pooled one.
   */
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),

  /**
   * Salts the analytics IP hash. `min(32)` is deliberate: a short salt makes the hash
   * reversible by brute force over the IPv4 space, which defeats the point of hashing.
   */
  APP_IP_SALT: z.string().min(32),

  /**
   * The **web app's** public origin, used to build shareable `/p/:slug` links.
   *
   * Deliberately not derived from the incoming request's host: a link put into a response has to be
   * one the recipient can open, which is the dashboard's origin, not the API's.
   */
  APP_PUBLIC_URL: z.url().default("http://localhost:3000"),

  /**
   * VAT in BASIS POINTS. 1900 = 19%, the Tunisian standard rate.
   *
   * Read once, at order creation, and then **snapshotted onto the order**. Changing this value
   * must never alter an invoice that has already been issued — which is why the order carries
   * its own `taxRateBp` rather than the invoice recomputing from configuration.
   */
  BILLING_TAX_RATE_BP: z.coerce.number().int().min(0).max(10_000).default(1900),

  /**
   * Cloudinary, for the CV photo — the flow ported from the portfolio repository (phase 5 audit §9).
   *
   * All three are **optional**, deliberately. The cloud name and API key are known; the API *secret*
   * is not, and it is the one that signs. Making them required would stop the API booting over a
   * feature nothing else depends on, so instead `POST /uploads/signature` refuses with a logged reason
   * until the secret arrives — the same shape as the Supabase verifier that is written and unwired
   * (phase 2 deviation 1).
   *
   * `CLOUDINARY_API_SECRET` never leaves the server: the browser receives a signature computed from it,
   * never the value. That is the entire reason the signing step exists rather than the client talking to
   * Cloudinary directly with a key.
   */
  CLOUDINARY_CLOUD_NAME: nonEmpty.optional(),
  CLOUDINARY_API_KEY: nonEmpty.optional(),
  CLOUDINARY_API_SECRET: nonEmpty.optional(),

  /**
   * Text generation, for the portfolio's written copy — headline, biography, brand summary.
   *
   * ## Why an OpenAI-compatible base URL rather than a provider SDK
   *
   * `AI_PROVIDER` names the vendor for logging and for the few places their APIs genuinely differ;
   * `AI_BASE_URL` is what the adapter actually calls. Groq, OpenAI, and most gateways all speak
   * `POST /chat/completions` with the same body, so one adapter and a URL covers today's Groq key and
   * tomorrow's OpenAI key with an env change and no code change. A vendor SDK per provider would be
   * three dependencies to keep the same behaviour.
   *
   * ## Optional, like Cloudinary, and for the same reason
   *
   * `AI_API_KEY` is a secret that may not be present in every environment, and generation is one feature.
   * The API must still boot without it — `POST /projects/:id/portfolio-content` refuses with a logged
   * reason instead, rather than the whole service failing to start over an optional integration.
   *
   * **`AI_API_KEY` never leaves the server.** The browser calls our endpoint; the key is attached here.
   * Handing it to the client would publish a billable credential to anyone who opens devtools.
   */
  AI_PROVIDER: z.enum(["groq", "openai", "gemini", "claude"]).default("groq"),
  AI_API_KEY: nonEmpty.optional(),
  AI_BASE_URL: nonEmpty.default("https://api.groq.com/openai/v1"),
  /**
   * Defaults to `openai/gpt-oss-120b`, **not** `llama-3.3-70b-versatile`.
   *
   * That Llama model has been retired from Groq — `GET /models` on a live key no longer lists it, so a
   * request naming it fails with `model_not_found`. Verified against the account, not assumed.
   */
  AI_MODEL: nonEmpty.default("openai/gpt-oss-120b"),
  /**
   * Wall-clock ceiling for one generation, in milliseconds.
   *
   * A generation happens while a user waits with a spinner, so a provider that stalls must fail fast
   * rather than hold a request open until the platform's own timeout. The observed latency on
   * `gpt-oss-120b` is under a second; 30s is a wide margin, not a target.
   */
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  AUTH_PROVIDER: z.enum(authProviders).default("local"),

  /** Only read when AUTH_PROVIDER=local. Signs the development-only bearer tokens. */
  LOCAL_AUTH_SECRET: z.string().min(32).optional(),
  LOCAL_AUTH_TOKEN_TTL: z.coerce.number().int().positive().default(86_400),

  /** Only read when AUTH_PROVIDER=supabase. Deliberately no service-role key — ADR-0001. */
  SUPABASE_URL: z.url().optional(),
  SUPABASE_JWT_AUDIENCE: nonEmpty.default("authenticated"),
});

/**
 * The provider-conditional half of the contract. Keeping these optional in the base schema
 * and required here is what lets the API boot with no Supabase project at all, while still
 * refusing to boot in Supabase mode without its URL — rather than failing on the first
 * authenticated request.
 */
export const envSchema = baseEnvSchema
  .superRefine((env, ctx) => {
    if (env.AUTH_PROVIDER === "supabase" && !env.SUPABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "SUPABASE_URL is required when AUTH_PROVIDER=supabase (used for JWKS discovery).",
      });
    }

    if (env.AUTH_PROVIDER === "local") {
      if (env.NODE_ENV === "production") {
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_PROVIDER"],
          message:
            "AUTH_PROVIDER=local is a development-only provider and must never run in production. Set AUTH_PROVIDER=supabase.",
        });
      }
      if (!env.LOCAL_AUTH_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["LOCAL_AUTH_SECRET"],
          message:
            "LOCAL_AUTH_SECRET (32+ characters) is required when AUTH_PROVIDER=local. Generate one with: openssl rand -base64 32",
        });
      }
    }
  })
  .transform((env) => ({
    ...env,
    isProduction: env.NODE_ENV === "production",
    isDevelopment: env.NODE_ENV === "development",
  }));

export type Env = z.infer<typeof envSchema>;

/**
 * Formats a Zod failure as a readable startup error. Nest's default output for a thrown
 * ZodError inside a config validator is an unreadable object dump, which is the opposite of
 * what a configuration error should produce.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const name = issue.path.join(".") || "(root)";
      return `  • ${name}: ${issue.message}`;
    });

    throw new Error(
      [
        "Invalid environment configuration. The API will not start.",
        ...lines,
        "",
        "Copy .env.example to apps/api/.env and fill in the values.",
      ].join("\n"),
    );
  }

  return result.data;
}

let cached: Env | undefined;

/**
 * The validated environment, available at **module-definition time**.
 *
 * `AppModule` needs one value — `AUTH_PROVIDER` — before Nest builds the DI container, because
 * whether a controller is mounted at all has to be decided while the module graph is being
 * described. `AppConfigService` does not exist that early.
 *
 * It loads `.env` itself for the same reason: `ConfigModule.forRoot` populates `process.env`
 * during module initialisation, which is after this runs. `dotenv` never overwrites a variable
 * that is already set, so a platform-provided value still wins over the file.
 *
 * Memoized, so the schema runs once whichever path reaches it first. Together with `validateEnv`
 * this is the only code that touches `process.env`, and it lives in `config/` — which is exactly
 * what the "no process.env outside config/" check exists to enforce.
 */
export function loadEnv(): Env {
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv") as { config: (o: { path: string }) => unknown };
    dotenv.config({ path: ".env" });
    cached = validateEnv(process.env);
  }
  return cached;
}
