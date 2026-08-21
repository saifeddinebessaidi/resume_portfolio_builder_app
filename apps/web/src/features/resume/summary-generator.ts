import { type ResumePayload } from "@repo/contracts";

/**
 * Composes a professional summary from what the user has already typed elsewhere.
 *
 * ## Why this is deterministic and not an LLM call
 *
 * It generates from the CV's **own** fields — job title, years of experience, employers, top skills,
 * highest qualification, languages — so it needs no API key, no provider decision, no per-click cost,
 * and it cannot invent a city, an employer or a degree the user never entered. That last property is the
 * one that matters: a fabricated line in a summary is a line the applicant has to defend in an
 * interview.
 *
 * An LLM would write more fluent prose, and the portfolio repository already contains a careful French
 * prompt for exactly this (with explicit anti-hallucination rules) that we could adopt. That is a real
 * upgrade and a scope decision — a provider, a key, a cost and a rate limit — rather than something to
 * slip in behind a button. This function is the shape that call would replace: same inputs, same output,
 * so swapping it is one import.
 *
 * ## It never overwrites silently
 *
 * The caller decides. The button is the user asking for a draft, and the text lands in an editable
 * field — a generator that quietly replaced a hand-written summary would destroy the better version.
 */

/**
 * The four content sections the generator draws on. The title is handled separately — it opens the
 * sentence rather than supplying material for it.
 */
export const SUMMARY_SOURCE_SECTIONS = ["experiences", "skills", "education", "languages"] as const;

export type SummarySourceSection = (typeof SUMMARY_SOURCE_SECTIONS)[number];

/**
 * **How many of those four must carry content before the button unlocks.**
 *
 * Three of four, by your call, and the reason is worth stating: a summary written from one section is
 * not a summary, it is that section rephrased. With `expérience` alone the output is "Manager. A
 * travaillé chez Acme." — three words the reader already has above it. Three sections is the point at
 * which there is enough to *combine*, which is the only thing that makes a generated paragraph worth
 * more than the fields it came from.
 *
 * It is also the honest gate for the AI version: the same threshold decides whether a model would have
 * enough context to write something faithful rather than padding.
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
function sectionHasContent(data: ResumePayload, section: SummarySourceSection): boolean {
  switch (section) {
    case "experiences":
      return data.experiences.some((e) => (e.title ?? "").trim().length > 0);
    case "skills":
      return data.skills.some((g) => g.items.some((i) => i.trim().length > 0));
    case "education":
      return data.education.some((e) => (e.degree ?? "").trim().length > 0);
    case "languages":
      return data.languages.some((l) => (l.name ?? "").trim().length > 0);
  }
}

export function summaryReadiness(data: ResumePayload): SummaryReadiness {
  const missing = SUMMARY_SOURCE_SECTIONS.filter((s) => !sectionHasContent(data, s));
  const filled = SUMMARY_SOURCE_SECTIONS.length - missing.length;
  const missingTitle = data.title.trim().length === 0;

  return {
    ready: !missingTitle && filled >= SUMMARY_MIN_SECTIONS,
    missingTitle,
    missing: [...missing],
    filled,
    required: SUMMARY_MIN_SECTIONS,
  };
}

const COPY = {
  fr: {
    opener: (title: string) => `${title}`,
    withYears: (years: number) =>
      years >= 2 ? ` avec ${String(years)} ans d'expérience` : " en début de parcours",
    basedIn: (location: string) => ` basé(e) à ${location}`,
    employers: (names: string[]) =>
      names.length === 1
        ? `A travaillé chez ${names[0]}.`
        : `A travaillé notamment chez ${names.slice(0, -1).join(", ")} et ${names.at(-1) ?? ""}.`,
    skills: (items: string[]) => `Compétences principales : ${items.join(", ")}.`,
    education: (degree: string, institution?: string) =>
      institution ? `Formation : ${degree}, ${institution}.` : `Formation : ${degree}.`,
    languages: (items: string[]) => `Langues : ${items.join(", ")}.`,
  },
  en: {
    opener: (title: string) => `${title}`,
    withYears: (years: number) =>
      years >= 2 ? ` with ${String(years)} years of experience` : " early in their career",
    basedIn: (location: string) => ` based in ${location}`,
    employers: (names: string[]) =>
      names.length === 1
        ? `Previously at ${names[0]}.`
        : `Previously at ${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}.`,
    skills: (items: string[]) => `Core skills: ${items.join(", ")}.`,
    education: (degree: string, institution?: string) =>
      institution ? `Education: ${degree}, ${institution}.` : `Education: ${degree}.`,
    languages: (items: string[]) => `Languages: ${items.join(", ")}.`,
  },
} as const;

/**
 * Years of experience, from the earliest 4-digit year found in any start date.
 *
 * Dates in this payload are free text (`"2024"`, `"Jan 2024"`, `"03/2024"`) because the builder this was
 * ported from never constrained them, so a regex for the year is the honest read. Returns 0 when nothing
 * parses, and the caller then omits the clause rather than printing "0 ans".
 */
function yearsOfExperience(data: ResumePayload, now: number): number {
  const years = data.experiences
    .map((e) => /(19|20)\d{2}/.exec(e.startDate ?? "")?.[0])
    .filter((y): y is string => y !== undefined)
    .map(Number)
    .filter((y) => y >= 1950 && y <= now);

  if (years.length === 0) return 0;
  return Math.max(0, now - Math.min(...years));
}

/**
 * The generated draft. Returns an empty string when there is not enough to work with, so the caller can
 * treat "nothing to say" as a state rather than shipping a sentence with holes in it.
 */
export function generateSummary(data: ResumePayload, now = new Date().getFullYear()): string {
  if (!summaryReadiness(data).ready) return "";

  const t = COPY[data.language];
  const sentences: string[] = [];

  // 1. Who they are: title, seniority, location.
  const years = yearsOfExperience(data, now);
  let opener = t.opener(data.title.trim());
  if (years > 0) opener += t.withYears(years);
  if (data.location?.trim()) opener += t.basedIn(data.location.trim());
  sentences.push(`${opener}.`);

  // 2. Where they have worked. Deduplicated and capped at three: a summary listing eight employers
  //    reads as a list, not a summary.
  const employers = [
    ...new Set(
      data.experiences
        .map((e) => e.company?.trim())
        .filter((c): c is string => c !== undefined && c.length > 0),
    ),
  ].slice(0, 3);
  if (employers.length > 0) sentences.push(t.employers(employers));

  // 3. Top skills, flattened across groups. Capped at six for the same reason.
  const skills = data.skills
    .flatMap((g) => g.items.map((i) => i.trim()).filter(Boolean))
    .slice(0, 6);
  if (skills.length > 0) sentences.push(t.skills(skills));

  // 4. The most recent qualification only — the array is newest-first by the editor's own ordering.
  const top = data.education[0];
  if (top?.degree.trim()) {
    // An explicit length check, not `||`: a whitespace-only institution trims to "" and must become
    // `undefined` so the sentence drops the clause rather than printing a trailing comma.
    const institution = top.institution?.trim();
    sentences.push(
      t.education(
        top.degree.trim(),
        institution !== undefined && institution.length > 0 ? institution : undefined,
      ),
    );
  }

  // 5. Languages, with levels where given.
  const languages = data.languages
    .map((l) => (l.level?.trim() ? `${l.name.trim()} (${l.level.trim()})` : l.name.trim()))
    .filter(Boolean);
  if (languages.length > 0) sentences.push(t.languages(languages));

  return sentences.join(" ");
}
