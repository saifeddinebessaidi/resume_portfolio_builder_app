import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { type Env } from "./env.schema";

/**
 * The only place in the application that reads configuration.
 *
 * Every other file injects this and calls a typed getter, so no module anywhere touches
 * `process.env` — which is what keeps the boot-time schema the single description of what
 * this service needs to run.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    // `infer: true` on ConfigService makes this non-nullable, because validateEnv has
    // already applied every default.
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env["NODE_ENV"] {
    return this.get("NODE_ENV");
  }

  get isProduction(): boolean {
    return this.get("isProduction");
  }

  get isDevelopment(): boolean {
    return this.get("isDevelopment");
  }

  get port(): number {
    return this.get("PORT");
  }

  get logLevel(): Env["LOG_LEVEL"] {
    return this.get("LOG_LEVEL");
  }

  get corsOrigins(): string[] {
    return this.get("CORS_ORIGINS");
  }

  get databaseUrl(): string {
    return this.get("DATABASE_URL");
  }

  get ipSalt(): string {
    return this.get("APP_IP_SALT");
  }

  /** The web app's origin, for building public `/p/:slug` links. */
  get appPublicUrl(): string {
    return this.get("APP_PUBLIC_URL");
  }

  /**
   * The VAT rate applied to a **new** order, in basis points. Existing orders read their own
   * snapshot — a rate change must not rewrite an issued invoice.
   */
  get billingTaxRateBp(): number {
    return this.get("BILLING_TAX_RATE_BP");
  }

  /**
   * The Cloudinary credentials, or `null` when the upload feature is not configured.
   *
   * Returned as one object rather than three getters so a caller cannot check two and forget the third —
   * signing with a missing secret produces a signature Cloudinary rejects, which is a far more confusing
   * failure than "not configured".
   */
  get cloudinary(): { cloudName: string; apiKey: string; apiSecret: string } | null {
    const cloudName = this.get("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.get("CLOUDINARY_API_KEY");
    const apiSecret = this.get("CLOUDINARY_API_SECRET");

    if (!cloudName || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  }

  /**
   * The text-generation credentials, or `null` when generation is not configured.
   *
   * One object rather than five getters, for the same reason as `cloudinary`: a caller cannot check the
   * key and forget the base URL. The key is the only part that can be absent — everything else has a
   * default — so its presence is what decides whether the feature exists.
   */
  get ai(): {
    provider: Env["AI_PROVIDER"];
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
  } | null {
    const apiKey = this.get("AI_API_KEY");
    if (!apiKey) return null;

    return {
      provider: this.get("AI_PROVIDER"),
      apiKey,
      // Trailing slash trimmed here so every call site can concatenate a path without thinking about it.
      baseUrl: this.get("AI_BASE_URL").replace(/\/$/, ""),
      model: this.get("AI_MODEL"),
      timeoutMs: this.get("AI_TIMEOUT_MS"),
    };
  }

  get authProvider(): Env["AUTH_PROVIDER"] {
    return this.get("AUTH_PROVIDER");
  }

  /**
   * Throws rather than returning undefined: the env schema guarantees this is present when
   * AUTH_PROVIDER=local, so reading it in any other mode is a programming error and should
   * be loud, not silently produce a token signed with `undefined`.
   */
  get localAuthSecret(): string {
    const secret = this.get("LOCAL_AUTH_SECRET");
    if (!secret) {
      throw new Error(
        "LOCAL_AUTH_SECRET read while AUTH_PROVIDER is not 'local'. This is a wiring bug.",
      );
    }
    return secret;
  }

  get localAuthTokenTtlSeconds(): number {
    return this.get("LOCAL_AUTH_TOKEN_TTL");
  }

  get supabaseUrl(): string {
    const url = this.get("SUPABASE_URL");
    if (!url) {
      throw new Error(
        "SUPABASE_URL read while AUTH_PROVIDER is not 'supabase'. This is a wiring bug.",
      );
    }
    return url;
  }

  get supabaseJwtAudience(): string {
    return this.get("SUPABASE_JWT_AUDIENCE");
  }
}
