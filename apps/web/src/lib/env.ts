import { z } from "zod";

/**
 * Public configuration, validated at module load.
 *
 * Imported by the root layout, so a missing variable fails the **build** rather than surfacing as an
 * undefined URL in a fetch at runtime.
 *
 * Every variable is referenced **literally** as `process.env.NEXT_PUBLIC_X`. Next's replacement is a
 * static text substitution at build time, so `process.env[key]`, a spread, or a computed lookup all
 * silently yield `undefined` — which is why this reads as a repetitive object rather than a loop.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),
  /** Where unauthenticated visitors go: this app has no login screen of its own. */
  NEXT_PUBLIC_LANDING_URL: z.url(),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_LANDING_URL: process.env.NEXT_PUBLIC_LANDING_URL,
});

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`);
  throw new Error(
    ["Invalid public environment configuration.", ...lines, "", "See apps/web/.env.local"].join(
      "\n",
    ),
  );
}

export const env = parsed.data;
