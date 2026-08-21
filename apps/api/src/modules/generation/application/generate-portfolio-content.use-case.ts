import { Inject, Injectable } from "@nestjs/common";
import {
  generatedPortfolioContentSchema,
  portfolioGenerationReadiness,
  portfolioPayloadSchema,
  type GeneratedPortfolioContent,
  type PortfolioPayload,
} from "@repo/contracts";

import { NotFoundError, ValidationFailedError } from "../../../common/errors/errors";
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from "../../projects/domain/project.repository";
import { TEXT_GENERATOR, type TextGenerator } from "../domain/text-generator.port";

/**
 * Writes a portfolio's `headline`, `biography`, `skills` and `brandSummary` from the facts the user
 * already entered.
 *
 * ## The prompt is built here, from the stored payload — never from client input
 *
 * The request body carries one boolean. Everything the model sees is assembled from the project's own
 * saved payload, read through `findByIdForOwner`. That is not tidiness: an endpoint that forwarded
 * client-supplied text to a billable model would be an open proxy to it, authenticated but unmetered,
 * and the account's quota would be someone else's to spend.
 *
 * It also bounds prompt injection. A user *can* write "ignore your instructions" in their own biography
 * field — but the only thing they can steer is the copy on their own portfolio, which they can already
 * edit by hand. There is no other tenant's data in the context to exfiltrate.
 *
 * ## Four fields, and the response schema enforces it
 *
 * The model is asked for exactly the four editable copy fields and the result is parsed with
 * `generatedPortfolioContentSchema`. Names, locations, follower counts, rates and experience credits are
 * **facts the user supplied** — a model that could return them would eventually invent a campaign or a
 * price onto a page someone sends to a casting director. Narrowing the response shape makes that
 * structurally impossible rather than a matter of how carefully the prompt is worded.
 *
 * ## Nothing is written
 *
 * The text is returned, not saved. The client puts it in the form and the ordinary autosave stores it —
 * so a generation costs no revision, and one the user dislikes is discarded by not saving it. Writing
 * here would consume a revision and clobber the biography they were mid-way through editing.
 */
@Injectable()
export class GeneratePortfolioContentUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(TEXT_GENERATOR) private readonly generator: TextGenerator,
  ) {}

  async execute(args: { projectId: string; userId: string }): Promise<GeneratedPortfolioContent> {
    /**
     * Ownership is part of the lookup, not a check after it — and not-found and not-owned both surface
     * as 404, so this cannot be used to probe whether another account's project id exists.
     */
    const project = await this.projects.findByIdForOwner(args.projectId, args.userId);
    if (!project || project.deletedAt) throw new NotFoundError("Ce projet est introuvable.");

    if (project.categoryCode !== "PORTFOLIO" && project.categoryCode !== "PORTFOLIO_PRO") {
      throw new ValidationFailedError([
        {
          path: "id",
          message: "La génération de contenu n'est disponible que pour un portfolio.",
        },
      ]);
    }

    const payload = portfolioPayloadSchema.parse(project.currentVersionData);

    /**
     * The same readiness rule the button uses, from `@repo/contracts`.
     *
     * Checked here too because a disabled button stops nobody with `curl`, and because generating from a
     * name alone produces fluent invention — which is worse than an empty field, since it looks finished.
     */
    const readiness = portfolioGenerationReadiness(payload);
    if (!readiness.ready) {
      throw new ValidationFailedError([
        {
          path: "data",
          message: readiness.missingName
            ? "Renseignez d'abord votre nom complet."
            : "Renseignez d'abord votre description, vos expériences, vos compétences ou vos réseaux.",
        },
      ]);
    }

    const raw = await this.generator.generateJson({
      system: SYSTEM_PROMPT,
      user: buildFactSheet(payload),
      maxOutputTokens: 900,
    });

    /**
     * Parsed with the contract schema, and **coerced first**.
     *
     * A model asked for a string array will sometimes return a comma-joined string, and asked for a
     * string will occasionally return an array of paragraphs. Both are trivially recoverable, and
     * failing the whole generation over a shape a normaliser can fix would be a worse product for no
     * gain in safety — the *fields* are still limited to the four, which is the part that matters.
     */
    return generatedPortfolioContentSchema.parse({
      headline: asText(raw.headline).slice(0, 200),
      biography: asText(raw.biography).slice(0, 6_000),
      brandSummary: asText(raw.brandSummary).slice(0, 2_000),
      skills: asList(raw.skills).slice(0, 30),
    });
  }
}

/**
 * Stable, server-side, and never user-controlled.
 *
 * Says "in French" because the whole product is French, and "no invention" explicitly: the single worst
 * failure here is a plausible fabricated credit on a page that goes to a casting director.
 */
const SYSTEM_PROMPT = [
  "Tu écris le contenu de portfolios pour des mannequins, acteurs, influenceurs et créateurs de contenu.",
  "Écris en français, à la troisième personne, dans un registre professionnel et sobre.",
  "N'invente RIEN : n'ajoute aucune marque, aucun chiffre, aucune date, aucun rôle qui ne figure pas dans les informations fournies.",
  /**
   * The two rules below were added because the first live generation broke both.
   *
   * Given 128 400 Instagram and 54 200 TikTok followers it wrote "plus de 180 000 abonnés combinés" — a
   * figure that appears nowhere in the input — and it placed a photo campaign "diffusée sur Instagram et
   * TikTok", a distribution channel nobody stated. Neither is a hallucinated *fact* in the usual sense;
   * both are inferences a reader would take as one, on a page sent to a casting director. "Do not invent"
   * did not cover arithmetic or plausible joins, so they are forbidden explicitly.
   *
   * Re-tested afterwards: the derived total is **gone** — every figure in two fresh generations traced
   * back to the input exactly as supplied. The channel attribution is **reduced, not eliminated**; it
   * still appeared in one of two runs. A prompt is a soft constraint and this is the honest state of it.
   * What makes that acceptable is the design around it: the text lands in the form for the user to read
   * and edit, and nothing is saved until they do — the generator drafts, the person publishes.
   */
  "Ne combine, n'additionne et ne calcule AUCUN chiffre : cite-les séparément, exactement comme fournis, ou pas du tout.",
  "N'associe pas un projet, un rôle ou une marque à une plateforme, un lieu ou une date qui ne lui est pas explicitement rattaché.",
  "Si une information manque, écris moins plutôt que d'inventer.",
  'Réponds uniquement par un objet JSON avec exactement ces clés : "headline" (une phrase, 90 caractères maximum),',
  '"biography" (deux paragraphes séparés par \\n\\n), "skills" (tableau de 5 à 10 courtes chaînes),',
  '"brandSummary" (deux phrases destinées aux marques).',
].join(" ");

/**
 * The facts, as a labelled block rather than JSON.
 *
 * Only fields the user filled in are included — an empty label reads as "this is unknown, fill it in"
 * to a model, and one of them will oblige. Follower counts are passed as written; the prompt forbids
 * inventing numbers, and these are the user's own claims.
 */
function buildFactSheet(data: PortfolioPayload): string {
  const lines: string[] = [];
  const add = (label: string, value: string | undefined): void => {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`);
  };

  add("Nom", data.fullName);
  add("Métier", data.profession);
  add("Ville", data.location);
  add("Accroche actuelle", data.tagline);
  add("Présentation écrite par la personne", data.description);

  if (data.skills.length > 0) add("Compétences", data.skills.join(", "));

  if (data.experiences.length > 0) {
    lines.push("Expériences:");
    for (const e of data.experiences) {
      if (!e.title.trim()) continue;
      lines.push(`- ${[e.title, e.role, e.year].filter((v) => v?.trim()).join(" — ")}`);
    }
  }

  if (data.works.length > 0) {
    lines.push("Projets:");
    for (const w of data.works) {
      if (!w.title.trim()) continue;
      lines.push(`- ${[w.title, w.category, w.description].filter((v) => v?.trim()).join(" — ")}`);
    }
  }

  const socials = [
    data.instagramUrl?.trim()
      ? `Instagram (${String(data.instagramFollowers ?? "?")} abonnés)`
      : null,
    data.tiktokUrl?.trim() ? `TikTok (${String(data.tiktokFollowers ?? "?")} abonnés)` : null,
    data.youtubeUrl?.trim() ? `YouTube (${String(data.youtubeSubscribers ?? "?")} abonnés)` : null,
  ].filter((v): v is string => v !== null);
  if (socials.length > 0) add("Réseaux", socials.join(", "));

  return lines.join("\n");
}

/** A string, or paragraphs the model returned as an array. Anything else becomes empty. */
function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string")
      .join("\n\n")
      .trim();
  }
  return "";
}

/** An array of strings, or a comma-separated string the model returned instead. */
function asList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : typeof value === "string"
      ? value.split(",")
      : [];

  return items.map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 120);
}
