import { z } from "zod";

/**
 * The RESUME payload — ported from the builder's `packages/shared/src/index.ts`
 * (https://github.com/SyrineLarbi/resume_builder), which is the authority on the shape its editor and
 * its templates expect.
 *
 * Three things were added on the way in, and each one has a reason:
 *
 * 1. **Every array has a `.max()` and every string a length cap.** The builder's schema has none.
 *    `ProjectVersion.data` is a `Jsonb` column read on every project open, and without an upper bound
 *    one pathological payload degrades every query that touches the row. The caps are generous enough
 *    that no real CV meets them.
 *
 * 2. **`id` is dropped.** The builder generated a client-side `crypto.randomUUID()` because
 *    `localStorage` needed a key. Our identity is `Project.id`, assigned by the database; keeping a
 *    second id inside the payload would create two sources of truth for "which resume is this".
 *
 * 3. **`updatedAt` is dropped.** The builder stamped it into the stored object. Ours is
 *    `Project.updatedAt`, set by Prisma, and a payload-carried timestamp would be a client-supplied
 *    value that could disagree with the row's own.
 *
 * Dates stay **strings** throughout, exactly as the builder has them (`"2024/01"`): a `Date` does not
 * survive `JSON.parse` — it returns as a string and silently breaks comparisons — so the payload stores
 * text and any boundary that needs a date converts explicitly.
 */

/** Generous caps: no real CV has 60 bullets on one job, and 2000 chars is several paragraphs. */
const bulletList = z.array(z.string().max(2_000)).max(60).default([]);

const shortText = z.string().max(200);
const optionalShortText = z.string().max(200).optional();
/** A "2024/01"-style date, kept as free text because the builder's inputs are free text. */
const dateText = z.string().max(20).optional();

export const resumeExperienceEntrySchema = z.object({
  title: shortText,
  company: optionalShortText,
  /** e.g. "(Remote) (Central Team)" */
  companyNote: optionalShortText,
  location: optionalShortText,
  startDate: dateText,
  /** Empty string renders as "Present" in the template. */
  endDate: dateText,
  bullets: bulletList,
});

export type ResumeExperienceEntry = z.infer<typeof resumeExperienceEntrySchema>;

export const skillGroupEntrySchema = z.object({
  /** "TECHNICAL SKILLS" | "SOFT SKILLS" — free text, because the user names their own groups. */
  heading: shortText,
  items: z.array(z.string().max(120)).max(80).default([]),
});

export type SkillGroupEntry = z.infer<typeof skillGroupEntrySchema>;

export const resumeProjectEntrySchema = z.object({
  title: shortText,
  technologies: optionalShortText,
  description: z.string().max(2_000).optional(),
  bullets: bulletList,
  githubUrl: z.string().max(500).optional(),
  demoUrl: z.string().max(500).optional(),
});

export type ResumeProjectEntry = z.infer<typeof resumeProjectEntrySchema>;

export const languageEntrySchema = z.object({
  name: shortText,
  level: optionalShortText,
});

export type LanguageEntry = z.infer<typeof languageEntrySchema>;

export const educationEntrySchema = z.object({
  degree: shortText,
  institution: optionalShortText,
  detail: optionalShortText,
  location: optionalShortText,
  startDate: dateText,
  endDate: dateText,
});

export type EducationEntry = z.infer<typeof educationEntrySchema>;

/**
 * The two résumé conventions the product sells against.
 *
 * They are genuinely different documents, not skins: a North-American résumé omits date of birth, photo
 * and marital status (an ATS in the US may be legally obliged to ignore them), leads with a summary and
 * keeps to one page; a European CV commonly carries a photo, a driving licence and a longer education
 * block. Grouping templates by convention is what lets a user pick the right *kind* of document before
 * fussing over its look.
 */
export const ResumeTemplateStyle = {
  NORTH_AMERICA: "NORTH_AMERICA",
  EUROPE: "EUROPE",
} as const;

export type ResumeTemplateStyle = (typeof ResumeTemplateStyle)[keyof typeof ResumeTemplateStyle];

/**
 * The template registry — id, the conventions it suits, and whether it is single- or two-column.
 *
 * Declared in contracts rather than the web app because the **id is stored in the payload**: it decides
 * which renderer the print route reaches for, so it is wire data with the same drift risk as any other
 * enum here. The registry travels with it so the picker cannot offer a template the renderer lacks.
 *
 * ## Why `styles` is a list
 *
 * The three designed templates are **North American**, per your last word on it. They moved to Europe
 * once and back; the round trip cost one line each time, which is the point of holding the convention as
 * template metadata rather than branching the renderers on it.
 *
 * Europe has no design of its own yet — the second set of references never arrived (the same three files
 * were attached twice). It carries only `ats` until they do.
 *
 * `ats` is listed under **both**. It is not a regional design at all: no photo, no date of birth, no
 * driving licence, just one column of text in a standard face. That is what a job-board parser wants in
 * Montréal and in Tunis alike, so filing it under one continent would hide it from half the users who
 * should be reaching for it — and would leave a tab with nothing in it while a perfectly suitable
 * template sat behind the other one.
 *
 * `columns` is metadata the picker uses to draw its thumbnail, and it is also the honest warning label:
 * a two-column CV is prettier and *worse* for a naive ATS parser, which reads left-to-right across the
 * page and interleaves the columns. `ats` exists for exactly that reason and stays the default.
 */
export const RESUME_TEMPLATES = [
  {
    id: "ats",
    styles: [ResumeTemplateStyle.NORTH_AMERICA, ResumeTemplateStyle.EUROPE],
    columns: 1,
    /** The only template guaranteed to survive machine parsing. */
    atsSafe: true,
    portrait: false,
  },
  {
    id: "classic",
    styles: [ResumeTemplateStyle.NORTH_AMERICA],
    columns: 1,
    atsSafe: true,
    portrait: false,
  },
  {
    id: "timeline",
    styles: [ResumeTemplateStyle.NORTH_AMERICA],
    columns: 2,
    atsSafe: false,
    portrait: false,
  },
  {
    id: "blush",
    styles: [ResumeTemplateStyle.NORTH_AMERICA],
    columns: 2,
    atsSafe: false,
    portrait: false,
  },

  // --- Europe. All three carry a portrait, which is what a European CV expects and a US one does not.
  {
    id: "aurora",
    styles: [ResumeTemplateStyle.EUROPE],
    columns: 2,
    atsSafe: false,
    portrait: true,
  },
  { id: "navy", styles: [ResumeTemplateStyle.EUROPE], columns: 2, atsSafe: false, portrait: true },
  {
    id: "terracotta",
    styles: [ResumeTemplateStyle.EUROPE],
    columns: 1,
    atsSafe: true,
    portrait: true,
  },
] as const satisfies readonly {
  id: string;
  styles: readonly ResumeTemplateStyle[];
  columns: 1 | 2;
  atsSafe: boolean;
  /**
   * Whether the design has a place for a photo.
   *
   * Separate from the convention on purpose. "Shows a portrait" and "is European" correlate but are not
   * the same claim: none of the three North-American designs has a photo slot, and gating the upload on
   * the continent rather than on the template meant the field had nowhere to appear at all. Asking the
   * template is the question that actually determines whether a photo can be rendered.
   */
  portrait: boolean;
}[];

export type ResumeTemplateId = (typeof RESUME_TEMPLATES)[number]["id"];

export const resumeTemplateIdSchema = z.enum(
  RESUME_TEMPLATES.map((t) => t.id) as [ResumeTemplateId, ...ResumeTemplateId[]],
);

export const templatesForStyle = (
  style: ResumeTemplateStyle,
): readonly (typeof RESUME_TEMPLATES)[number][] =>
  RESUME_TEMPLATES.filter((t) => (t.styles as readonly ResumeTemplateStyle[]).includes(style));

/**
 * Which tab the picker should open on for a stored template.
 *
 * The first of its conventions, so `ats` — which suits both — opens on North America rather than
 * silently reclassifying a user's CV the moment they open the picker.
 */
export const styleOfTemplate = (id: ResumeTemplateId): ResumeTemplateStyle =>
  RESUME_TEMPLATES.find((t) => t.id === id)?.styles[0] ?? ResumeTemplateStyle.NORTH_AMERICA;

/**
 * Whether the selected design can show a photo — which is what decides if the upload field appears.
 *
 * Replaces the earlier `style === EUROPE` test. That was a proxy that happened to be wrong in both
 * directions: it offered a photo for European templates that had no slot for one, and hid it from any
 * design outside Europe that did.
 */
export const templateHasPortrait = (id: ResumeTemplateId): boolean =>
  RESUME_TEMPLATES.find((t) => t.id === id)?.portrait === true;

/** Fields that only a European CV conventionally carries: loisirs, permis. */
export const templateWantsEuropeanFields = (id: ResumeTemplateId): boolean =>
  styleOfTemplate(id) === ResumeTemplateStyle.EUROPE;

/**
 * The whole resume: one contract for the API's validation pipe, the editor's state, the template and
 * the print route — the same "single declaration" idea as the rest of this package (ADR-0009).
 *
 * `layout` is **user data and belongs in the payload**: it is a choice the user made, and reopening a
 * CV has to restore the design they picked. What is deliberately *not* here is UI state — no open
 * accordion panel, no scroll position, no "currently selected section". Persisting those makes every
 * version diff unreadable and every revision comparison useless.
 *
 * `photoUrl` holds a URL or a `ProjectAsset` id, never inline binary: a base64 image in a `Jsonb`
 * column bloats every read of that row.
 */
export const resumePayloadSchema = z.object({
  /** The dashboard label. The project's own `title` is authoritative; this mirrors it for the editor. */
  name: z.string().max(160).default("Mon CV"),
  /**
   * @deprecated Superseded by `template`, which names an actual renderer.
   *
   * Kept in the schema so stored payloads still parse — every existing CV carries it — but nothing reads
   * it. It only ever had two values and one of them ("styled") rendered identically to the other,
   * because no second renderer existed. Removing the field would mean a data migration for a value that
   * costs a boolean's worth of storage.
   */
  layout: z.enum(["styled", "ats"]).default("styled"),
  /**
   * **Which design renders this CV**, in the preview and in the PDF.
   *
   * Payload data for the same reason `language` is: it is a choice the user made about their document,
   * and reopening the CV has to restore it. Defaults to `ats` — the plain single-column layout — because
   * that is the only one guaranteed to survive an applicant-tracking system, and defaulting to a
   * two-column design would quietly make every existing CV less machine-readable.
   */
  template: resumeTemplateIdSchema.default("ats"),
  /**
   * The language the CV is **written and printed in** — the template's own headings ("Professional
   * Experience" vs "Expérience professionnelle") and its date words.
   *
   * Payload data, not a UI preference: a Tunisian applicant sends a French CV to a local employer and
   * an English one abroad, and the same account holds both. Storing it per CV is what lets one be
   * reopened without inheriting the other's language. It does **not** translate the editor chrome,
   * which stays French with the rest of the dashboard.
   *
   * Defaults to `fr`, matching the product's own language. `en` is offered because the ATS template
   * was authored with English headings, and an applicant abroad needs them.
   */
  language: z.enum(["fr", "en"]).default("fr"),

  fullName: z.string().max(160).default(""),
  title: z.string().max(200).default(""),
  photoUrl: z.string().max(1_000).optional(),

  email: z.string().max(320).default(""),
  phone: optionalShortText,
  location: optionalShortText,
  website: z.string().max(500).optional(),
  github: z.string().max(500).optional(),
  linkedin: z.string().max(500).optional(),

  summary: z.string().max(4_000).optional(),
  /**
   * Whether the résumé has already been generated for this CV. **One generation per CV**, by your call.
   *
   * Persisted in the payload rather than held in component state, because component state resets on
   * reload — "once" that a refresh undoes is not once. Stored per CV, so a second CV gets its own turn.
   *
   * Worth being explicit that this is a **UX constraint, not an entitlement**: the payload is
   * client-writable, so a determined user could reset it with a crafted `PATCH`. That is acceptable —
   * nothing is being paid for here, and the rule exists to stop someone re-rolling the same paragraph
   * repeatedly rather than editing it. If it ever needs to be enforced it belongs on the server, next to
   * the export counter.
   */
  summaryGenerated: z.boolean().default(false),

  experiences: z.array(resumeExperienceEntrySchema).max(40).default([]),
  skills: z.array(skillGroupEntrySchema).max(20).default([]),
  projects: z.array(resumeProjectEntrySchema).max(40).default([]),
  languages: z.array(languageEntrySchema).max(20).default([]),
  education: z.array(educationEntrySchema).max(20).default([]),

  /**
   * **Loisirs / intérêts** — a European CV convention, and all three European designs give it a section.
   *
   * Deliberately absent from the North-American templates rather than merely unused: "Sport de haut
   * niveau (judo & tennis)" on a US résumé is filler at best, and at worst volunteers personal
   * information a US employer would rather not have in the file.
   *
   * A flat string list, not `{name, level}` objects: unlike languages, a hobby has no scale.
   */
  interests: z.array(z.string().max(120)).max(20).default([]),

  /**
   * **Permis de conduire.** Free text, because what belongs here differs by country — "Permis B",
   * "Permis B — véhicule personnel", "Catégorie B" — and an enum would be wrong in the first market
   * that spells it differently.
   *
   * European only, for the same reason as `interests`: it appears on the Thomas Garcia reference and on
   * no North-American résumé.
   */
  drivingLicence: optionalShortText,
});

export type ResumePayload = z.infer<typeof resumePayloadSchema>;

/**
 * A blank resume with every default applied.
 *
 * Used by `POST /projects` when no `data` is supplied, so a freshly created CV opens with a complete,
 * valid shape rather than an empty object the editor has to defend against field by field.
 */
export const emptyResumePayload = (): ResumePayload => resumePayloadSchema.parse({});

/**
 * How complete a CV is, as a percentage plus the per-step detail behind it.
 *
 * ## Why it lives here and not in the editor
 *
 * The dashboard shows a progress bar and the editor shows the same number, so it has to be **one**
 * definition or the two drift and the bar disagrees with the form. It sits next to the schema it reads
 * because that is what it is: knowledge about the payload's shape, not about either UI.
 *
 * ## Five sections, twenty percent each — your call
 *
 * This is the third weighting, and the previous two were both mine and both wrong. Worth recording why,
 * because the mistake was a category error rather than arithmetic:
 *
 * 1. Identity 65 / content 35 — reported immediately: four empty sections still read 75%.
 * 2. Identity 30 / content 70 — arithmetically defensible, but "only a job title" came out at 10% when
 *    you had already told me it should read 20%.
 *
 * The lesson is that "how finished is this CV" is a **product judgment about what a section is worth**,
 * not something derivable from the schema. So it is now the flat model you chose: the five sections a
 * user recognises from the form, each worth a fifth.
 *
 * The property that makes it predictable — and the reason it is defensible where my weighted versions
 * were not — is that the number is always just **how many of five sections have content**. 2 of 5 is 40%,
 * always, with no table to consult.
 *
 * `Profil` is satisfied by **any** of its fields, which is why a lone job title reads 20%: the section
 * has been started. `résumé` lives inside `Profil` rather than standing alone — it is the profile *text*,
 * and it is the reason `Profil` is one section rather than four tiny ones.
 *
 * `projects` is deliberately excluded. It is genuinely optional — plenty of strong CVs have none — and
 * counting it would cap an otherwise complete CV below 100% for a choice the user made correctly.
 */
export const RESUME_COMPLETION_STEPS = [
  { key: "profile", weight: 20 },
  { key: "experience", weight: 20 },
  { key: "skills", weight: 20 },
  { key: "education", weight: 20 },
  { key: "languages", weight: 20 },
] as const satisfies readonly { key: string; weight: number }[];

export type ResumeCompletionStepKey = (typeof RESUME_COMPLETION_STEPS)[number]["key"];

export interface ResumeCompletionStep {
  key: ResumeCompletionStepKey;
  weight: number;
  done: boolean;
}

export interface ResumeCompletion {
  /** 0–100. The five weights sum to 100, so this needs no normalisation. */
  percent: number;
  steps: ResumeCompletionStep[];
}

const filled = (v: string | undefined): boolean => (v ?? "").trim().length > 0;

/**
 * A section counts when it carries **real content**, not merely an existing row.
 *
 * An experience entry with a blank title is an empty card the user added and never filled; counting it
 * would let someone reach 100% by pressing "Ajouter" five times.
 */
export function resumeCompletion(data: ResumePayload): ResumeCompletion {
  const done: Record<ResumeCompletionStepKey, boolean> = {
    // Any identity field starts the section — name, job title, either contact channel, or the summary.
    profile:
      filled(data.fullName) ||
      filled(data.title) ||
      filled(data.email) ||
      filled(data.phone) ||
      filled(data.summary),
    experience: data.experiences.some((e) => filled(e.title)),
    skills: data.skills.some((g) => g.items.some((i) => filled(i))),
    education: data.education.some((e) => filled(e.degree)),
    languages: data.languages.some((l) => filled(l.name)),
  };

  const steps = RESUME_COMPLETION_STEPS.map((s) => ({ ...s, done: done[s.key] }));
  const earned = steps.reduce((sum, s) => (s.done ? sum + s.weight : sum), 0);

  return { percent: Math.round(earned), steps };
}

/* ------------------------------------------------------------------------------------------------
 * Profil generation readiness
 *
 * Moved here from the web app's `summary-generator.ts` when the Profil started being written by the
 * model rather than by a string template. It has to be **one** definition for the same reason
 * `resumeCompletion` does, and for one more: the button that shows the rule and the endpoint that
 * enforces it are now in different processes. A disabled button stops nobody holding `curl`, and a
 * generation from a job title alone produces fluent invention — which is worse than an empty field,
 * because it looks finished.
 *
 * The threshold and the four sections are unchanged from the deterministic version.
 * ---------------------------------------------------------------------------------------------- */

/**
 * The four content sections the Profil draws on. The job title is handled separately — it opens the
 * paragraph rather than supplying material for it.
 */
export const SUMMARY_SOURCE_SECTIONS = ["experiences", "skills", "education", "languages"] as const;

export type SummarySourceSection = (typeof SUMMARY_SOURCE_SECTIONS)[number];

/**
 * **How many of those four must carry content before a Profil can be written.**
 *
 * Three of four. A summary written from one section is not a summary, it is that section rephrased:
 * with `expériences` alone the output is "Manager. A travaillé chez Acme." — words the reader already
 * has above it. Three is the point at which there is enough to *combine*, which is the only thing that
 * makes the paragraph worth more than the fields it came from.
 *
 * It is also the honest gate for the model: the same threshold decides whether there is enough context
 * to write something faithful rather than padding.
 */
export const SUMMARY_MIN_SECTIONS = 3;

export interface SummaryReadiness {
  ready: boolean;
  /** The job title, which opens the summary. Missing means no sentence can start. */
  missingTitle: boolean;
  /** Which of the four source sections are still empty, for the UI to name. */
  missing: SummarySourceSection[];
  /** How many carry content, and how many are needed — so the hint can count down. */
  filled: number;
  required: number;
}

/** A section counts only when it holds real content — an empty card the user added does not. */
function summarySectionHasContent(data: ResumePayload, section: SummarySourceSection): boolean {
  switch (section) {
    case "experiences":
      return data.experiences.some((e) => filled(e.title));
    case "skills":
      return data.skills.some((g) => g.items.some((i) => filled(i)));
    case "education":
      return data.education.some((e) => filled(e.degree));
    case "languages":
      return data.languages.some((l) => filled(l.name));
  }
}

export function summaryReadiness(data: ResumePayload): SummaryReadiness {
  const missing = SUMMARY_SOURCE_SECTIONS.filter((s) => !summarySectionHasContent(data, s));
  const filledCount = SUMMARY_SOURCE_SECTIONS.length - missing.length;
  const missingTitle = !filled(data.title);

  return {
    ready: !missingTitle && filledCount >= SUMMARY_MIN_SECTIONS,
    missingTitle,
    missing: [...missing],
    filled: filledCount,
    required: SUMMARY_MIN_SECTIONS,
  };
}

/**
 * What `GET /uploads/signature` returns — the parameters a browser needs to `POST` a file straight to
 * Cloudinary, and nothing else.
 *
 * `apiKey` is public by design: it travels in the upload request the browser makes. The **secret** is not
 * here and never is; the server used it to compute `signature` and kept it. That asymmetry is the whole
 * point of the signing step.
 */
/**
 * What kind of asset a signature authorises.
 *
 * Cloudinary has a **separate upload endpoint per resource type** (`/image/upload` vs `/video/upload`)
 * and a signature is bound to the folder it names — so the kind has to travel with the signature rather
 * than being decided by the browser afterwards. Sending a video to the image endpoint fails with an
 * error that does not mention the resource type, which is why this is explicit.
 */
export const uploadKindSchema = z.enum(["image", "video"]);

export type UploadKind = z.infer<typeof uploadKindSchema>;

export const uploadSignatureSchema = z.object({
  cloudName: z.string().min(1),
  apiKey: z.string().min(1),
  /** Seconds since the epoch. Cloudinary rejects a signature much older than an hour. */
  timestamp: z.number().int().positive(),
  folder: z.string().min(1),
  signature: z.string().min(1),
  /**
   * Which Cloudinary endpoint this signature is for. The **server** decides it, from the requested
   * kind — a client that chose its own could sign an image request and upload video into the photo
   * folder, past the size limit the folder exists to bound.
   */
  resourceType: uploadKindSchema,
});

export type UploadSignature = z.infer<typeof uploadSignatureSchema>;

/** Enforced in the browser before a byte is sent, and again by what the signed folder accepts. */
export const RESUME_PHOTO_MAX_BYTES = 5_000_000;
export const RESUME_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Video limits for Portfolio Pro.
 *
 * 100MB because that is Cloudinary's own ceiling for a single unsigned/signed browser upload on the free
 * plan — a larger file fails at their end, so accepting it here would only move the error later. MP4 and
 * WebM are the two containers every current browser can play inline; MOV is included because it is what
 * an iPhone produces and rejecting it would turn away the most common source of a showreel.
 */
export const PORTFOLIO_VIDEO_MAX_BYTES = 100_000_000;
export const PORTFOLIO_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
