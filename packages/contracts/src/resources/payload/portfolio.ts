import { z } from "zod";

import {
  PORTFOLIO_GENERATION_INPUT_KEYS,
  PORTFOLIO_GENERATION_MIN_SOURCES,
  type PortfolioGenerationReadiness,
} from "../generation";

/**
 * The PORTFOLIO payload — ported from the audited repository
 * (https://github.com/SyrineLarbi/AI-powered-Digital-Talent-Portfolio-Platform), whose `Portfolio` model
 * and `packages/shared` Zod schemas are the authority on what its form and its renderer expect.
 *
 * ## What "porting" meant here
 *
 * That repository stores a portfolio across **five relational tables** — `Portfolio` plus `Photo`,
 * `Experience`, `PricingItem` and `Project`. ADR-0004 puts the editable payload in one `Jsonb` column
 * instead, so each child table becomes an array here. All four are ordered lists of flat objects, so the
 * mapping is mechanical rather than a redesign — which is what the phase 5 audit concluded.
 *
 * The one thing that does **not** move into the payload is photos. They stay relational (as
 * `ProjectAsset`) because `ASSET_STORAGE_MB` has to be summable and a URL must survive independently of
 * a version snapshot. Here they are referenced by URL, exactly as the original did.
 *
 * ## Deliberate departures from the original
 *
 * - **`slug` and `status` are absent.** The original kept publication state on the same row. Ours lives on
 *   `ProjectPublication` and `Project.status`, which is what makes the hosting term and the reserved-slug
 *   rule enforceable. A second copy inside the payload would be a client-writable publication flag.
 * - **`userId` is absent**, for the same reason `id` was dropped from the resume payload: ownership is
 *   `Project.userId`, assigned server-side.
 * - **Every array is capped and every string bounded.** The original has no limits at all, and this is a
 *   `Jsonb` column read on every open.
 * - **`showPhone` / `showDob` are kept but now mean something.** In the original `showDob` was stored and
 *   never read, and `showPhone` was honoured by the public API while the renderer ignored it. Whatever
 *   consumes this payload must apply both.
 */

const shortText = z.string().max(200);
const optionalShortText = z.string().max(200).optional();

/**
 * The professions the original offers. Kept verbatim, including `other`, because the whole product is
 * aimed at this audience — actresses, models, influencers, content creators — and a generic "job title"
 * field would lose the vocabulary its renderer and its AI prompt are written around.
 */
export const PortfolioProfession = {
  ACTRESS: "actress",
  ACTOR: "actor",
  MODEL: "model",
  INFLUENCER: "influencer",
  CONTENT_CREATOR: "content_creator",
  OTHER: "other",
} as const;

export type PortfolioProfession = (typeof PortfolioProfession)[keyof typeof PortfolioProfession];

export const portfolioProfessionSchema = z.enum(PortfolioProfession);

/** An acting credit, a brand collaboration, or something else — the original's three types. */
export const portfolioExperienceSchema = z.object({
  type: z.enum(["acting_credit", "brand_collab", "other"]).default("acting_credit"),
  title: shortText,
  role: optionalShortText,
  /** Free text, as in the original: "2024", "2023 – 2024", "Été 2022". */
  year: optionalShortText,
  note: z.string().max(2_000).optional(),
});

export type PortfolioExperience = z.infer<typeof portfolioExperienceSchema>;

/**
 * A rate-card line. **Prices are integer minor units** — the original stored plain integers with a
 * separate currency string, and ADR-0006 is the same idea made explicit: 250 TND is 250000 millimes.
 */
export const portfolioPricingSchema = z.object({
  /** reels | live | events | other — free text, because a creator names their own offers. */
  category: shortText,
  label: shortText,
  priceMinMinor: z.number().int().min(0).optional(),
  priceMaxMinor: z.number().int().min(0).optional(),
  currency: z.enum(["TND", "EUR", "USD"]).default("TND"),
});

export type PortfolioPricing = z.infer<typeof portfolioPricingSchema>;

/** A piece of work. `imageUrl` is a stored asset's URL, never inline binary. */
export const portfolioWorkSchema = z.object({
  title: shortText,
  category: optionalShortText,
  description: z.string().max(2_000).optional(),
  imageUrl: z.string().max(1_000).optional(),
  /** The original's flag: featured items render large, the rest as a list. */
  featured: z.boolean().default(false),
});

export type PortfolioWork = z.infer<typeof portfolioWorkSchema>;

/** One uploaded image. `assetUrl` is the Cloudinary `secure_url`; `isCover` picks the hero. */
export const portfolioPhotoSchema = z.object({
  assetUrl: z.string().max(1_000),
  /** Kept so a gallery can reserve space and avoid layout shift — the original stores both. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  isCover: z.boolean().default(false),
});

export type PortfolioPhoto = z.infer<typeof portfolioPhotoSchema>;

/**
 * One video in the Portfolio **Pro** reel.
 *
 * `assetUrl` is the Cloudinary `secure_url` of an uploaded file, not an embed. A showreel that has to be
 * a YouTube iframe cannot be the muted, looping, full-bleed hero the design calls for — their player
 * insists on its own chrome and its autoplay policy is theirs to change. Hosting the file is what makes
 * the cover video possible at all, so both the cover and the reel use the same mechanism.
 *
 * `posterUrl` is the still shown before playback. Optional, and worth having: without one a `<video>`
 * renders as a black rectangle until the first frame decodes, which on a slow connection is most of the
 * time a visitor spends looking at it.
 */
export const portfolioVideoSchema = z.object({
  assetUrl: z.string().max(1_000),
  title: optionalShortText,
  posterUrl: z.string().max(1_000).optional(),
  /** Seconds, from Cloudinary's upload response. Displayed, never used to gate anything. */
  durationSeconds: z.number().int().min(0).optional(),
});

export type PortfolioVideo = z.infer<typeof portfolioVideoSchema>;

export const portfolioPayloadSchema = z.object({
  /** The dashboard label, mirroring `Project.title` for the editor. */
  name: z.string().max(160).default("Mon portfolio"),

  // --- identity ---
  fullName: z.string().max(160).default(""),
  profession: portfolioProfessionSchema.default("other"),
  gender: optionalShortText,
  location: z.string().max(200).default(""),
  /** Private by default, and the flags below decide what the public page may show. */
  email: z.string().max(320).default(""),
  phone: optionalShortText,
  dateOfBirth: optionalShortText,
  addressText: z.string().max(500).optional(),

  /**
   * Privacy flags. Both must be honoured by every consumer — the original stored `showDob` and never
   * read it, which is how a supposedly private field ends up on a public page.
   */
  showPhone: z.boolean().default(false),
  showDob: z.boolean().default(false),

  // --- how the talent describes themselves, before any generation ---
  description: z.string().max(4_000).optional(),

  // --- the generated / editable copy ---
  headline: z.string().max(200).optional(),
  biography: z.string().max(6_000).optional(),
  skills: z.array(z.string().max(120)).max(30).default([]),
  brandSummary: z.string().max(2_000).optional(),

  // --- display fields the original's template reads ---
  tagline: z.string().max(300).optional(),
  availabilityText: z.string().max(300).optional(),
  availabilityDate: optionalShortText,
  resumeUrl: z.string().max(1_000).optional(),

  // --- socials, and self-reported audience ---
  instagramUrl: z.string().max(500).optional(),
  /**
   * Facebook — present in the reference's payload and its renderer, and missing here until now.
   *
   * Its absence was not a design decision, it was an omission: the reference sums `facebookFollowers`
   * into the audience total and lists the page alongside the others, so a creator whose audience is
   * mostly on Facebook had no way to say so. Optional like the rest, and the payload is `Jsonb`, so
   * existing rows parse unchanged with the field simply absent.
   */
  facebookUrl: z.string().max(500).optional(),
  tiktokUrl: z.string().max(500).optional(),
  youtubeUrl: z.string().max(500).optional(),
  instagramFollowers: z.number().int().min(0).optional(),
  facebookFollowers: z.number().int().min(0).optional(),
  tiktokFollowers: z.number().int().min(0).optional(),
  youtubeSubscribers: z.number().int().min(0).optional(),
  reach: z.number().int().min(0).optional(),
  engagement: z.number().int().min(0).optional(),

  /**
   * --- Portfolio **Pro** only ---
   *
   * Both live on the shared payload rather than in a second schema, because PORTFOLIO and PORTFOLIO_PRO
   * are one `Project` table and one payload column (ADR-0004). A separate `portfolioProPayloadSchema`
   * would fork every helper — completion, readiness, the form, the renderer — to express two optional
   * fields, and it would make upgrading a Portfolio to Pro a data migration instead of a category change.
   *
   * The **renderer** is what gates them: `PublicPortfolio` only reads these when `pro` is set, so a
   * PORTFOLIO row that somehow carried a video would not show one. Same for the form.
   */
  coverVideoUrl: z.string().max(1_000).optional(),
  coverVideoPosterUrl: z.string().max(1_000).optional(),
  videos: z.array(portfolioVideoSchema).max(12).default([]),

  // --- the four lists that were child tables in the original ---
  photos: z.array(portfolioPhotoSchema).max(40).default([]),
  experiences: z.array(portfolioExperienceSchema).max(40).default([]),
  pricing: z.array(portfolioPricingSchema).max(20).default([]),
  works: z.array(portfolioWorkSchema).max(40).default([]),
});

export type PortfolioPayload = z.infer<typeof portfolioPayloadSchema>;

export const emptyPortfolioPayload = (): PortfolioPayload => portfolioPayloadSchema.parse({});

/**
 * Completion, on the same five-equal-sections model the résumé uses.
 *
 * Deliberately the same shape and the same arithmetic — "how many of five sections have content" — so the
 * dashboard's progress bar means the same thing whichever category a row belongs to. A second scoring
 * scheme would make one bar incomparable with the one beside it.
 */
export const PORTFOLIO_COMPLETION_STEPS = [
  { key: "profile", weight: 20 },
  { key: "photos", weight: 20 },
  { key: "experiences", weight: 20 },
  { key: "skills", weight: 20 },
  { key: "socials", weight: 20 },
] as const satisfies readonly { key: string; weight: number }[];

export type PortfolioCompletionStepKey = (typeof PORTFOLIO_COMPLETION_STEPS)[number]["key"];

export interface PortfolioCompletion {
  percent: number;
  steps: { key: PortfolioCompletionStepKey; weight: number; done: boolean }[];
}

const filled = (v: string | undefined): boolean => (v ?? "").trim().length > 0;

/**
 * Whether there is enough real material to generate the written copy from.
 *
 * Lives here rather than in the API so the **button and the endpoint apply one rule**. A client-side
 * check alone would be a suggestion — `curl` bypasses it — and a server-side check alone would leave the
 * button enabled until it failed. Both read this.
 *
 * The bar is a name plus one of {description, experiences, skills, socials}. Deliberately low: it is not
 * a quality gate, it is the line between writing *about someone* and inventing a person. A model handed
 * only "Célia, mannequin" produces fluent, specific, entirely fabricated biography — which is worse than
 * an empty field, because it looks finished.
 */
export function portfolioGenerationReadiness(data: PortfolioPayload): PortfolioGenerationReadiness {
  const present = {
    description: filled(data.description),
    experiences: data.experiences.some((e) => filled(e.title)),
    skills: data.skills.some((s) => filled(s)),
    socials:
      filled(data.instagramUrl) ||
      filled(data.facebookUrl) ||
      filled(data.tiktokUrl) ||
      filled(data.youtubeUrl),
  };

  const missing = PORTFOLIO_GENERATION_INPUT_KEYS.filter((k) => !present[k]);
  const missingName = !filled(data.fullName);
  const sources = PORTFOLIO_GENERATION_INPUT_KEYS.length - missing.length;

  return {
    ready: !missingName && sources >= PORTFOLIO_GENERATION_MIN_SOURCES,
    missingName,
    missing: [...missing],
  };
}

export function portfolioCompletion(data: PortfolioPayload): PortfolioCompletion {
  const done: Record<PortfolioCompletionStepKey, boolean> = {
    profile:
      filled(data.fullName) ||
      filled(data.location) ||
      filled(data.email) ||
      filled(data.description) ||
      filled(data.biography),
    photos: data.photos.some((p) => filled(p.assetUrl)),
    experiences: data.experiences.some((e) => filled(e.title)),
    skills: data.skills.some((s) => filled(s)),
    // Any one channel is enough — a model with only Instagram is not half a portfolio.
    socials:
      filled(data.instagramUrl) ||
      filled(data.facebookUrl) ||
      filled(data.tiktokUrl) ||
      filled(data.youtubeUrl),
  };

  const steps = PORTFOLIO_COMPLETION_STEPS.map((s) => ({ ...s, done: done[s.key] }));

  return { percent: steps.reduce((sum, s) => (s.done ? sum + s.weight : sum), 0), steps };
}
