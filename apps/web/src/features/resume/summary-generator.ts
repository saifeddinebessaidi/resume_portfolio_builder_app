import { summaryReadiness, type ResumePayload } from "@repo/contracts";

/**
 * Composes a professional summary from what the user has already typed elsewhere.
 *
 * ## This is now the **fallback**, not the generator
 *
 * The Profil is written by the model, server-side, at `POST /projects/:id/resume-summary`. This function
 * runs only when that call fails — the server has no `AI_API_KEY`, or the provider was unreachable —
 * and it exists so the button still does something useful on a deployment without generation
 * configured. It does not spend the CV's single generation; see `SummarySection` in `resume-form.tsx`.
 *
 * ## Why it is kept rather than deleted
 *
 * It needs no key, no provider, no per-click cost, and it cannot invent a city, an employer or a degree
 * the user never entered. That last property is the one that matters on a CV: a fabricated line is one
 * the applicant has to defend in an interview.
 *
 * What it **cannot** do is write a summary. It re-emits the fields it is given, in a fixed order, so its
 * output restates the sections printed directly beneath it — and it never reads `experiences[].bullets`,
 * which is the only material describing what the person actually does. That limitation is structural,
 * not a matter of better wording, and it is precisely why the model call now sits in front of it.
 *
 * ## It never overwrites silently
 *
 * The caller decides. The button is the user asking for a draft, and the text lands in an editable
 * field — a generator that quietly replaced a hand-written summary would destroy the better version.
 *
 * `summaryReadiness` moved to `@repo/contracts` when the server started enforcing the same gate: a
 * disabled button stops nobody with `curl`, and one definition is what keeps the hint and the endpoint
 * from disagreeing.
 */

const COPY = {
  fr: {
    opener: (title: string) => `${title}`,
    withYears: (years: number) =>
      years >= 2 ? ` avec ${String(years)} ans d'expérience` : " en début de parcours",
    // "basé(e) à" was the previous wording. The parenthesised agreement is the kind of thing a reader
    // notices on a CV, and "à Tunis" carries the same information without it.
    basedIn: (location: string) => ` à ${location}`,
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

  /**
   * 3. Top skills, flattened across groups. Capped at six for the same reason.
   *
   * Trailing punctuation is stripped from each item before joining. Users type skills with a full stop
   * on the end often enough — "Planification stratégique." — and the sentence template appends its own,
   * which produced the reported "Hubspot & Dynamics 365.." and a comma list that read as separate
   * sentences.
   */
  const skills = data.skills
    .flatMap((g) =>
      g.items
        .map((i) =>
          i
            .trim()
            .replace(/[.;,]+$/, "")
            .trim(),
        )
        .filter(Boolean),
    )
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
