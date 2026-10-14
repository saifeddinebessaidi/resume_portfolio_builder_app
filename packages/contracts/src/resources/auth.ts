import { z } from "zod";

/**
 * Email + password authentication (AUTH_PROVIDER=password). The API issues the session token;
 * the web app stores it in an httpOnly cookie and never exposes it to scripts.
 */
const emailSchema = z.email().trim().toLowerCase().max(254);

/** Length over composition rules: 10+ characters, capped so hashing cannot be used as a DoS. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const signUpRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    fullName: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

export const signInRequestSchema = z
  .object({
    email: emailSchema,
    // Not length-checked beyond the cap: a password set under an older rule must still sign in.
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const authTokenResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  /** Seconds. The web app uses it as the cookie's max-age. */
  expiresIn: z.number().int().positive(),
});

export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;
