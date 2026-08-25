import { type ResumePayload } from "@repo/contracts";

import { GhostLines, Ph } from "./template-parts";
import { PROFILE_LINK_KEYS, PROFILE_LINK_LABEL, absoluteUrl } from "./links";

import { capitalizeFirst, capitalizeSentences, properName } from "@/lib/display-text";
import type { ReactNode } from "react";

/**
 * The ATS-plain resume layout — **ported from the builder repository's
 * `apps/web/components/resume/ats-template.tsx`**, adapted only where it referenced its own
 * `ResumeData` type (now `ResumePayload` from `@repo/contracts`).
 *
 * Single column, no photo, no icons, black on white, standard headings, plain-text parseable. The
 * point-based sizing (`pt`, not `rem`) is deliberate and kept as-is: this renders to A4 for print, and
 * points are the unit that survives the PDF boundary predictably.
 *
 * It builds a **flat list of blocks** rather than nested markup, and that is the load-bearing design:
 * one bullet is its own block, so a long list can flow across a page boundary instead of pushing an
 * entire job entry onto the next page. `keepWithNext` marks a heading that must not be orphaned at the
 * bottom of a page. The paginator in phase 4 step 05 consumes exactly this.
 */
export interface ResumeBlock {
  id: string;
  node: ReactNode;
  /** True when this block must not be the last on a page — headings, and entries with bullets. */
  keepWithNext?: boolean;
}

/**
 * The printed vocabulary, per `payload.language`.
 *
 * Deliberately **not** `messages/fr.ts`. That file is the dashboard's chrome, which is French for
 * everyone; this is the *document's* language, which the user chooses per CV. Wiring the template to the
 * UI locale would mean a French dashboard could only ever print a French CV — the opposite of what an
 * applicant sending abroad needs.
 *
 * The English column is the builder's original wording, kept verbatim so an existing CV prints
 * byte-identically when its language is `en`.
 */
const SHEET_LABELS = {
  en: {
    summary: "Summary",
    skills: "Technical Skills",
    experience: "Professional Experience",
    projects: "Projects",
    education: "Education",
    languages: "Languages",
    /** Sidebar heading in the designed templates; the ATS layout has no contact heading. */
    contact: "Contact",
    /** An open-ended job: the end date is blank. */
    present: "Present",
    /**
     * Stand-ins shown **only in the editor preview**, never in the PDF — see `placeholders` on
     * `ResumeSheet`. They name what belongs in each slot so an empty sheet still communicates its layout.
     */
    phName: "Your name",
    phTitle: "Job title",
    phPhone: "Phone number",
    phEmail: "email@example.com",
    phLocation: "City, Country",
    interests: "Interests",
  },
  fr: {
    summary: "Profil",
    skills: "Compétences techniques",
    experience: "Expérience professionnelle",
    projects: "Projets",
    education: "Formation",
    languages: "Langues",
    contact: "Contact",
    present: "Présent",
    phName: "Votre nom",
    phTitle: "Titre professionnel",
    phPhone: "Téléphone",
    phEmail: "email@exemple.com",
    phLocation: "Ville, Pays",
    interests: "Loisirs",
  },
} as const satisfies Record<ResumePayload["language"], Record<string, string>>;

/** Widened to `string` per key: the two columns hold different literals, so the narrow `as const` type
 *  of either one would reject the other. `keyof` still makes a missing label a compile error. */
export type SheetLabels = Record<keyof (typeof SHEET_LABELS)["fr"], string>;

export const labelsFor = (data: ResumePayload): SheetLabels => SHEET_LABELS[data.language];

function AtsHeading({ children }: { children: string }): ReactNode {
  return (
    <h2
      style={{
        fontSize: "11.5pt",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        borderBottom: "1px solid #333",
        paddingBottom: "2pt",
        marginTop: "14pt",
        marginBottom: "6pt",
      }}
    >
      {children}
    </h2>
  );
}

function AtsHeader({
  data,
  placeholders: ph = false,
}: {
  data: ResumePayload;
  placeholders?: boolean;
}): ReactNode {
  const t = labelsFor(data);
  const contact = [data.email, data.phone, data.location].filter(Boolean).join("  |  ");

  /**
   * The profile links, as **names rather than addresses** — "LinkedIn", not the forty-character URL that
   * used to sit beside it. The address is the anchor's `href`, so it still reaches the PDF and is still
   * clickable; what is gone is a header line that pushed the phone number and the city onto a second row.
   *
   * The label used to be printed *as well as* the URL ("LinkedIn: https://…"), which named the network
   * twice. Now the label is the link.
   */
  const links = PROFILE_LINK_KEYS.map((key) => ({ key, raw: data[key] ?? "" }))
    .filter((l) => l.raw.trim().length > 0)
    .map((l) => ({
      key: l.key,
      label: PROFILE_LINK_LABEL[l.key],
      href: absoluteUrl(l.raw.trim()),
    }));

  return (
    <header style={{ marginBottom: "4pt" }}>
      <div style={{ fontSize: "20pt", fontWeight: 700, letterSpacing: "0.02em" }}>
        <Ph value={properName(data.fullName)} label={t.phName} on={ph} />
      </div>
      {data.title || ph ? (
        <div style={{ fontSize: "11.5pt", marginTop: "1pt" }}>
          <Ph value={capitalizeFirst(data.title)} label={t.phTitle} on={ph} />
        </div>
      ) : null}
      {contact ? (
        <div style={{ fontSize: "10pt", marginTop: "5pt" }}>{contact}</div>
      ) : ph ? (
        <div style={{ fontSize: "10pt", marginTop: "5pt", opacity: 0.34 }} aria-hidden>
          {[t.phPhone, t.phEmail, t.phLocation].join("  |  ")}
        </div>
      ) : null}
      {links.length > 0 ? (
        <div style={{ fontSize: "10pt", marginTop: "2pt" }}>
          {links.map((l, i) => (
            <span key={l.key}>
              {i > 0 ? "  |  " : null}
              <a href={l.href} style={{ color: "inherit" }}>
                {l.label}
              </a>
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}

const bulletBlock = (b: string, first: boolean): ReactNode => (
  <ul
    style={{ listStyle: "disc", paddingLeft: "16pt", margin: 0, marginTop: first ? "2pt" : "1pt" }}
  >
    <li>{capitalizeSentences(b)}</li>
  </ul>
);

const BODY = { fontSize: "10.5pt", lineHeight: 1.4 } as const;

export function buildAtsBlocks(
  data: ResumePayload,
  /**
   * `placeholders` fills empty sections with faint bars for the editor preview. Off by default, so the
   * print route — which never passes it — emits the real document.
   */
  options: { placeholders?: boolean } = {},
): ResumeBlock[] {
  // Resolved once here rather than per heading, so a new section cannot quietly reintroduce a
  // hard-coded English string.
  const t = labelsFor(data);
  const ph = options.placeholders ?? false;

  const blocks: ResumeBlock[] = [
    { id: "ats-header", node: <AtsHeader data={data} placeholders={ph} /> },
  ];

  if (data.summary || ph) {
    blocks.push({ id: "sum-h", keepWithNext: true, node: <AtsHeading>{t.summary}</AtsHeading> });
    blocks.push({
      id: "sum",
      node: data.summary ? (
        <p style={BODY}>{capitalizeSentences(data.summary)}</p>
      ) : (
        <GhostLines count={3} />
      ),
    });
  }

  if (data.skills.length > 0 || ph) {
    blocks.push({
      id: "sk-h",
      keepWithNext: true,
      node: <AtsHeading>{t.skills}</AtsHeading>,
    });
    if (data.skills.length === 0) blocks.push({ id: "sk-ph", node: <GhostLines count={2} /> });
    blocks.push({
      id: "sk",
      node: (
        <div style={BODY}>
          {data.skills.map((g) => (
            <div key={g.heading} style={{ marginBottom: "2pt" }}>
              <span style={{ fontWeight: 700 }}>{capitalizeFirst(g.heading)}: </span>
              {g.items.map((i) => capitalizeFirst(i)).join(", ")}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (data.experiences.length > 0 || ph) {
    blocks.push({
      id: "exp-h",
      keepWithNext: true,
      node: <AtsHeading>{t.experience}</AtsHeading>,
    });

    if (data.experiences.length === 0)
      blocks.push({ id: "exp-ph", node: <GhostLines count={5} /> });
    data.experiences.forEach((e, i) => {
      const meta = [
        [capitalizeFirst(e.company), e.companyNote].filter(Boolean).join(" "),
        /**
         * An **empty string** endDate renders as "Present" / "Présent" — the builder's own
         * convention, kept.
         *
         * Deliberately not `e.endDate ?? t.present`, which the linter suggests: `??` only catches
         * null/undefined, so `""` would fall through and the entry would show no end at all instead of
         * the present marker. The explicit length check is what makes that distinction survive a
         * refactor.
         */
        [e.startDate, e.endDate && e.endDate.length > 0 ? e.endDate : t.present]
          .filter(Boolean)
          .join(" – "),
        e.location,
      ]
        .filter(Boolean)
        .join("  |  ");

      blocks.push({
        id: `exp-${i}`,
        keepWithNext: e.bullets.length > 0,
        node: (
          <div style={{ ...BODY, marginTop: i ? "6pt" : 0 }}>
            <div style={{ fontWeight: 700 }}>{capitalizeFirst(e.title)}</div>
            {meta ? <div>{meta}</div> : null}
          </div>
        ),
      });

      e.bullets.forEach((b, j) =>
        blocks.push({ id: `exp-${i}-b${j}`, node: bulletBlock(b, j === 0) }),
      );
    });
  }

  if (data.projects.length > 0) {
    blocks.push({ id: "pr-h", keepWithNext: true, node: <AtsHeading>{t.projects}</AtsHeading> });

    data.projects.forEach((p, i) => {
      blocks.push({
        id: `pr-${i}`,
        keepWithNext: p.bullets.length > 0,
        node: (
          <div style={{ ...BODY, marginTop: i ? "6pt" : 0 }}>
            <div style={{ fontWeight: 700 }}>
              {capitalizeFirst(p.title)}
              {p.technologies ? ` — ${p.technologies}` : ""}
            </div>
            {p.githubUrl || p.demoUrl ? (
              <div>
                {p.githubUrl ? (
                  <>
                    GitHub:{" "}
                    <a href={absoluteUrl(p.githubUrl)} style={{ color: "inherit" }}>
                      {p.githubUrl}
                    </a>
                  </>
                ) : null}
                {p.githubUrl && p.demoUrl ? "   |   " : null}
                {p.demoUrl ? (
                  <>
                    Demo:{" "}
                    <a href={absoluteUrl(p.demoUrl)} style={{ color: "inherit" }}>
                      {p.demoUrl}
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}
            {p.description ? <div>{capitalizeSentences(p.description)}</div> : null}
          </div>
        ),
      });

      p.bullets.forEach((b, j) =>
        blocks.push({ id: `pr-${i}-b${j}`, node: bulletBlock(b, j === 0) }),
      );
    });
  }

  if (data.education.length > 0 || ph) {
    blocks.push({ id: "ed-h", keepWithNext: true, node: <AtsHeading>{t.education}</AtsHeading> });

    if (data.education.length === 0) blocks.push({ id: "ed-ph", node: <GhostLines count={2} /> });
    data.education.forEach((e, i) => {
      const head = [capitalizeFirst(e.degree), capitalizeFirst(e.institution)]
        .filter(Boolean)
        .join(" — ");
      const dates = [e.startDate, e.endDate].filter(Boolean).join(" – ");

      blocks.push({
        id: `ed-${i}`,
        node: (
          <div style={{ ...BODY, marginTop: i ? "4pt" : 0 }}>
            <div>
              <span style={{ fontWeight: 700 }}>{head}</span>
              {dates ? `  |  ${dates}` : ""}
            </div>
            {e.detail ? <div>{capitalizeSentences(e.detail)}</div> : null}
          </div>
        ),
      });
    });
  }

  if (data.languages.length > 0 || ph) {
    blocks.push({ id: "la-h", keepWithNext: true, node: <AtsHeading>{t.languages}</AtsHeading> });
    blocks.push({
      id: "la",
      node: (
        <p style={BODY}>
          {data.languages
            .map((l) =>
              l.level
                ? `${capitalizeFirst(l.name)} (${capitalizeFirst(l.level)})`
                : capitalizeFirst(l.name),
            )
            .join("  |  ")}
        </p>
      ),
    });
  }

  return blocks;
}
