import { z } from "zod";

/**
 * `POST /projects/:id/portfolio-content` — the AI-written copy for a portfolio.
 *
 * ## Only the four fields the model is allowed to write
 *
 * `headline`, `biography`, `skills`, `brandSummary`. The generator never returns a name, a location, an
 * email, a follower count, a rate or an experience — those are facts the user supplied, and a model that
 * could rewrite them would invent credits and prices onto a page someone sends to a casting director.
 * Narrowing the *response shape* is what makes that structurally impossible rather than a matter of
 * prompt discipline.
 *
 * ## Why a response, not a mutation
 *
 * The endpoint returns the text and writes nothing. The client shows it in the form, the user edits it,
 * and the ordinary autosave stores it — so generation costs no revision of its own, and a generation the
 * user dislikes is discarded by not saving. Writing directly would consume a revision and overwrite the
 * biography they were still editing.
 */
export const generatePortfolioContentRequestSchema = z
  .object({
    /**
     * Regenerating is allowed but must be asked for explicitly, so an accidental second press cannot
     * silently replace copy the user has since edited by hand. The client pairs this with a confirmation.
     */
    replaceExisting: z.boolean().default(false),
  })
  .strict();

export type GeneratePortfolioContentRequest = z.infer<typeof generatePortfolioContentRequestSchema>;

export const generatedPortfolioContentSchema = z.object({
  /** Bounded to the payload's own limits, so generated text can never be too long to store. */
  headline: z.string().max(200),
  biography: z.string().max(6_000),
  skills: z.array(z.string().max(120)).max(30),
  brandSummary: z.string().max(2_000),
});

export type GeneratedPortfolioContent = z.infer<typeof generatedPortfolioContentSchema>;

/**
 * The minimum a generation needs to say anything true.
 *
 * A model given only a name will write a confident paragraph about a person it knows nothing about —
 * fluent, specific, and invented. Requiring a profession plus at least one of {description, experiences,
 * skills, socials} means every generation has real material to work from. Enforced server-side, and
 * mirrored in the client so the button can explain itself before it is pressed.
 */
export const PORTFOLIO_GENERATION_INPUT_KEYS = [
  "description",
  "experiences",
  "skills",
  "socials",
] as const;

export type PortfolioGenerationInputKey = (typeof PORTFOLIO_GENERATION_INPUT_KEYS)[number];

export interface PortfolioGenerationReadiness {
  ready: boolean;
  /** True when `fullName` is blank — a portfolio with no name has nothing to write about. */
  missingName: boolean;
  /** Which of the four material sources are empty. */
  missing: PortfolioGenerationInputKey[];
}

/** How many of the four sources must be present. One is enough to ground the copy in something real. */
export const PORTFOLIO_GENERATION_MIN_SOURCES = 1;

/**
 * `POST /projects/:id/resume-summary` — the CV's « Profil » paragraph.
 *
 * ## One field, and that is the whole safety argument
 *
 * The model returns `summary` and nothing else. Every other thing on a CV — the employers, the dates,
 * the degree, the job titles — is a **claim the applicant will be asked to defend in an interview**,
 * and a generator that could rewrite them would eventually move a date or promote someone a grade. As
 * with the portfolio, narrowing the response shape is what makes that structurally impossible rather
 * than a matter of how carefully the prompt is worded.
 *
 * ## Why it is prose and not a list
 *
 * The Profil is the one section of a CV that is *not* a list — every other section already is one. The
 * generator this replaced was a string template, so it could only ever emit "Compétences principales :
 * a, b, c. Formation : … Langues : …" — three lines restating three sections the reader can see for
 * themselves, immediately below. The prompt forbids that shape explicitly.
 *
 * ## No request body
 *
 * Unlike the portfolio's `replaceExisting`, there is nothing to send: a Profil is generated once per CV,
 * so there is no "yes, overwrite" for the client to record.
 */
export const generatedResumeSummarySchema = z.object({
  /** Bounded to the payload's own `summary` limit, so generated text can never be too long to store. */
  summary: z.string().max(4_000),
});

export type GeneratedResumeSummary = z.infer<typeof generatedResumeSummarySchema>;
