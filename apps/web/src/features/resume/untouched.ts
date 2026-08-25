import { type ResumePayload } from "@repo/contracts";

/**
 * Whether nothing at all has been written into this CV yet.
 *
 * ## What it decides
 *
 * The editor preview's `placeholders` flag — faint labels and grey bars standing in for unwritten slots
 * (see `template-parts.tsx`). Those exist to answer one question, "what does this template look like?",
 * and they answer it only while there is no CV to look at. The moment a real name is on the sheet the
 * bars stop being a preview of the layout and start being **noise in the middle of the user's document**:
 * a filled Expérience section followed by four grey rectangles reads as damage, not as guidance.
 *
 * So it is deliberately all-or-nothing, and that is the whole change from the previous behaviour. Each
 * template used to decide per section (`showSection(hasContent, ph)`), which meant a CV with experience
 * and skills filled still printed ghost bars under Profil, Formation and Langues — permanently, because
 * plenty of good CVs never fill all five. What the sheet shows now is exactly the user's progress: what
 * they have written, and nothing else.
 *
 * ## Why not `resumeCompletion(...).percent === 0`
 *
 * It is nearly the same test and it was the obvious one to reach for, but it is the wrong question by a
 * few fields. Completion counts the five sections the *progress bar* is about, so `location`, `website`,
 * `linkedin`, a portrait, `interests` and `projects` all read as 0% — someone who had uploaded a photo
 * and typed a city would still be told, in grey bars, that their CV was empty. This asks the question the
 * renderer actually needs: **is there anything to draw?**
 *
 * The two agree on the case that matters — a CV created a second ago is untouched by both — so the
 * preview still shows its layout on a genuinely blank sheet.
 */
const filled = (v: string | undefined): boolean => (v ?? "").trim().length > 0;

const anyFilled = (...values: (string | undefined)[]): boolean => values.some(filled);

export function isUntouchedResume(data: ResumePayload): boolean {
  const identity = anyFilled(
    data.fullName,
    data.title,
    data.email,
    data.phone,
    data.location,
    data.website,
    data.github,
    data.linkedin,
    data.summary,
    data.photoUrl,
    data.drivingLicence,
  );

  /**
   * An entry counts when **any** of its fields carries text — not only the one the progress bar keys on.
   *
   * `resumeCompletion` requires `experiences[].title` specifically, because a card with a company and no
   * job title should not earn a fifth of the progress bar. Here the bar is not the point: that card *is*
   * rendered by every template, so a sheet that draws it and grey placeholder bars in the same breath is
   * contradicting itself.
   */
  const experiences = data.experiences.some(
    (e) =>
      anyFilled(e.title, e.company, e.companyNote, e.location, e.startDate, e.endDate) ||
      e.bullets.some(filled),
  );

  const skills = data.skills.some((g) => filled(g.heading) || g.items.some(filled));

  const projects = data.projects.some(
    (p) =>
      anyFilled(p.title, p.technologies, p.description, p.githubUrl, p.demoUrl) ||
      p.bullets.some(filled),
  );

  const education = data.education.some((e) =>
    anyFilled(e.degree, e.institution, e.detail, e.startDate, e.endDate),
  );

  const languages = data.languages.some((l) => anyFilled(l.name, l.level));

  const interests = data.interests.some(filled);

  return !(identity || experiences || skills || projects || education || languages || interests);
}
