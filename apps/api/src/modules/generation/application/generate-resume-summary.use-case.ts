import { Inject, Injectable } from "@nestjs/common";
import {
  CategoryCode,
  generatedResumeSummarySchema,
  resumePayloadSchema,
  summaryReadiness,
  type GeneratedResumeSummary,
  type ResumePayload,
} from "@repo/contracts";

import { NotFoundError, ValidationFailedError } from "../../../common/errors/errors";
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from "../../projects/domain/project.repository";
import { TEXT_GENERATOR, type TextGenerator } from "../domain/text-generator.port";
import { asText } from "./coerce";

/**
 * Writes a CV's « Profil » paragraph from the facts the applicant already entered.
 *
 * ## What this replaced, and why it had to be replaced
 *
 * The Profil used to be composed in the browser by a string template. It produced, verbatim:
 *
 * > Head Of Operation avec 4 ans d'expérience basé(e) à Tunis. A travaillé notamment chez Gomycode et
 * > Heetch. Compétences principales : Planification stratégique. PowerBI & Looker. Hubspot & Dynamics
 * > 365.. Formation : Licence en administration des affaire, ISET. Langues : Français, Anglais, Arabe.
 *
 * Every clause there restates a section printed **immediately below it on the same sheet**. That is the
 * structural failure, not a matter of wording: a template can only re-emit the fields it is given, in
 * the order it was written, so the one section of a CV that is supposed to be prose came out as a
 * fourth copy of the lists. The template also never read `experiences[].bullets`, which is the only
 * field describing what the person actually *does* — so the material for a real summary was present
 * and unused.
 *
 * ## The prompt is built here, from the stored payload — never from client input
 *
 * The request has no body at all. Everything the model sees is assembled from the project's own saved
 * payload, read through `findByIdForOwner`. An endpoint that forwarded client-supplied text to a
 * billable model would be an open proxy to it, authenticated but unmetered, and the account's quota
 * would be someone else's to spend. Same rule as the portfolio use case, same reason.
 *
 * ## One field out
 *
 * `summary`, and nothing else. Employers, dates, degrees and job titles are claims the applicant will
 * be asked to defend in an interview; a generator able to rewrite them would eventually move a date or
 * promote someone a grade. The response schema is what prevents that, rather than prompt discipline.
 *
 * ## Nothing is written
 *
 * The text is returned, not saved — the client puts it in the form and the ordinary autosave stores it.
 * So a generation costs no revision, and one the applicant dislikes is discarded by not saving it.
 */
@Injectable()
export class GenerateResumeSummaryUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(TEXT_GENERATOR) private readonly generator: TextGenerator,
  ) {}

  async execute(args: { projectId: string; userId: string }): Promise<GeneratedResumeSummary> {
    /**
     * Ownership is part of the lookup, not a check after it — and not-found and not-owned both surface
     * as 404, so this cannot be used to probe whether another account's project id exists.
     */
    const project = await this.projects.findByIdForOwner(args.projectId, args.userId);
    if (!project || project.deletedAt) throw new NotFoundError("Ce projet est introuvable.");

    if (project.categoryCode !== CategoryCode.RESUME) {
      throw new ValidationFailedError([
        { path: "id", message: "La génération du profil n'est disponible que pour un CV." },
      ]);
    }

    const payload = resumePayloadSchema.parse(project.currentVersionData);

    /**
     * The same readiness rule the button shows, from `@repo/contracts`.
     *
     * Checked here too because a disabled button stops nobody with `curl`, and because a Profil written
     * from a job title alone is fluent invention — worse than an empty field, since it looks finished.
     */
    const readiness = summaryReadiness(payload);
    if (!readiness.ready) {
      throw new ValidationFailedError([
        {
          path: "data",
          message: readiness.missingTitle
            ? "Renseignez d'abord votre titre professionnel."
            : `Renseignez d'abord au moins ${String(readiness.required)} sections parmi vos expériences, compétences, formations et langues.`,
        },
      ]);
    }

    const raw = await this.generator.generateJson({
      system: systemPrompt(payload.language),
      /**
       * 400, against the portfolio's 900. A Profil is one paragraph; the portfolio call has to cover
       * two paragraphs plus a headline, a skills array and a brand summary. The adapter adds its own
       * reasoning headroom on top of whatever is asked for here.
       */
      maxOutputTokens: 400,
      user: buildFactSheet(payload),
    });

    return generatedResumeSummarySchema.parse({ summary: asText(raw.summary).slice(0, 4_000) });
  }
}

/**
 * Stable, server-side, and never user-controlled.
 *
 * ## Branched on the CV's own language, not the product's
 *
 * The portfolio prompt hardcodes "Écris en français" because that whole product is French. A CV is not:
 * `payload.language` is a per-document choice, and a Tunisian applicant sends a French CV locally and
 * an English one abroad from the same account. A Profil written in French on an English CV is a defect
 * the user cannot fix without rewriting the paragraph by hand.
 *
 * ## The rules that address the actual complaint
 *
 * The three "prose, not a list" rules are the ones that fix what was reported. Forbidding the specific
 * strings — « Compétences principales : », « Formation : », « Langues : » — matters more than the
 * general instruction: those are the exact shapes the old template emitted, and a model shown a CV's
 * worth of fields will reach for them unprompted because they are the conventional way to *list* this
 * material. The point of the section is that it is the one part of the page that is not a list.
 *
 * ## The anti-hallucination rules are inherited, not invented here
 *
 * They are carried over from the portfolio prompt, where they were added after live failures — the
 * model summed two follower counts into a total that appeared nowhere in the input, and attached a
 * project to a distribution channel nobody had stated. Both are inferences a reader takes as facts.
 * On a CV the equivalent errors are worse: a combined "6 ans d'expérience" derived from two overlapping
 * jobs, or a tool credited to the wrong employer, is something the applicant has to defend in an
 * interview having never claimed it.
 *
 * A prompt is a soft constraint and this is the honest state of it. What makes it acceptable is the
 * design around it: the text lands in an editable field, and nothing is saved until the applicant reads
 * it — the generator drafts, the person signs.
 */
function systemPrompt(language: ResumePayload["language"]): string {
  if (language === "en") {
    return [
      "You are writing the Summary section of a professional résumé.",
      'Write in English, in the third person, with no personal pronoun and no "I".',
      "Three to four sentences, a single paragraph, between 400 and 600 characters.",
      "Write connected prose: relate the facts to one another — the role, the field, what the person does day to day, what they bring — rather than listing them.",
      'NEVER write a list. No "Core skills: …", no "Education: …", no "Languages: …". Those sections already appear elsewhere on the résumé.',
      "Invent NOTHING: no employer, figure, date, qualification, tool or responsibility that is not in the information supplied.",
      "Do not combine, add up or calculate any figure: quote them separately, exactly as supplied, or not at all.",
      "Do not attribute a skill or a tool to a particular employer unless that link is stated explicitly.",
      "If something is missing, write less rather than inventing.",
      'Reply only with a JSON object containing exactly one key: "summary".',
    ].join(" ");
  }

  return [
    "Tu rédiges la section « Profil » d'un CV professionnel.",
    "Écris en français, à la troisième personne, sans pronom personnel et sans « je ».",
    "Trois à quatre phrases, un seul paragraphe, entre 400 et 600 caractères.",
    "Écris de la prose liée : relie les faits entre eux — le métier, le secteur, ce que la personne fait au quotidien, ce qu'elle apporte — plutôt que de les énumérer.",
    "N'écris JAMAIS une liste : pas de « Compétences principales : … », pas de « Formation : … », pas de « Langues : … ». Ces sections figurent déjà ailleurs sur le CV.",
    "N'invente RIEN : aucun employeur, chiffre, date, diplôme, outil ni responsabilité qui ne figure pas dans les informations fournies.",
    "Ne combine, n'additionne et ne calcule AUCUN chiffre : cite-les séparément, exactement comme fournis, ou pas du tout.",
    "N'attribue pas une compétence ou un outil à un employeur précis si le lien n'est pas explicite.",
    "Si une information manque, écris moins plutôt que d'inventer.",
    'Réponds uniquement par un objet JSON avec exactement une clé : "summary".',
  ].join(" ");
}

/**
 * The facts, as a labelled block rather than JSON.
 *
 * Only fields the applicant filled in are included — an empty label reads as "this is unknown, fill it
 * in" to a model, and one of them will oblige.
 *
 * **The bullets are the reason this produces prose at all.** A job title and an employer support one
 * sentence: "Head of Operations, passé par Gomycode et Heetch." What someone did in the role —
 * "structuré le suivi commercial", "déployé les tableaux de bord" — is the only material that can
 * become a paragraph rather than a caption. The template this replaced ignored them entirely, which is
 * the single biggest reason its output never rose above a fact list.
 */
function buildFactSheet(data: ResumePayload): string {
  const lines: string[] = [];
  const add = (label: string, value: string | undefined): void => {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`);
  };

  add("Titre professionnel", data.title);
  add("Ville", data.location);

  const experiences = data.experiences.filter((e) => e.title.trim().length > 0);
  if (experiences.length > 0) {
    lines.push("Expériences:");
    for (const e of experiences) {
      const dates = [e.startDate, e.endDate].map((d) => d?.trim()).filter(Boolean);
      lines.push(
        `- ${[e.title.trim(), e.company?.trim(), dates.join(" – ")].filter(Boolean).join(" — ")}`,
      );
      // Indented under their job, so the model can tell which role a responsibility belongs to. The
      // prompt forbids attributing anything across entries; the layout is what makes that followable.
      for (const b of e.bullets) {
        if (b.trim()) lines.push(`  · ${b.trim()}`);
      }
    }
  }

  const skills = data.skills.flatMap((g) => g.items.map((i) => i.trim())).filter(Boolean);
  if (skills.length > 0) add("Compétences", skills.join(", "));

  const education = data.education.filter((e) => e.degree.trim().length > 0);
  if (education.length > 0) {
    lines.push("Formation:");
    for (const e of education) {
      lines.push(`- ${[e.degree.trim(), e.institution?.trim()].filter(Boolean).join(" — ")}`);
    }
  }

  const languages = data.languages
    .filter((l) => l.name.trim().length > 0)
    .map((l) => (l.level?.trim() ? `${l.name.trim()} (${l.level.trim()})` : l.name.trim()));
  if (languages.length > 0) add("Langues", languages.join(", "));

  const interests = data.interests.map((i) => i.trim()).filter(Boolean);
  if (interests.length > 0) add("Loisirs", interests.join(", "));

  return lines.join("\n");
}
