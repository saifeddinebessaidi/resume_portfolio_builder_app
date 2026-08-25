import { type ResumePayload } from "@repo/contracts";
import type { ReactNode } from "react";

import {
  AVOID_BREAK,
  Bullets,
  ContactValue,
  GhostLines,
  Ph,
  Portrait,
  SANS,
  SHEET,
  contactLines,
  dateRange,
  flatSkills,
  languageLines,
  showSection,
} from "./template-parts";
import { capitalizeFirst, capitalizeSentences, properName } from "@/lib/display-text";
import { labelsFor } from "./ats-template";

/**
 * **Terracotta** — single column, warm accent, three-column footer (the "Marianne Girard" reference).
 *
 * Portrait top-left beside a letter-spaced name, the job title in terracotta, a contact row, then a
 * full-width intro paragraph. Experience and education use a **date gutter** where the dates are
 * terracotta and the employer is bold beneath them. The page ends with Langues / Compétences / Loisirs
 * side by side.
 *
 * ## Why this one is `atsSafe` despite the footer
 *
 * The footer's three columns are three sequential `<section>`s in a grid — the DOM order is Langues, then
 * Compétences, then Loisirs, exactly as a parser reads them. That is the distinction that matters for
 * machine readability: a *visual* multi-column arrangement of linear content is fine; what breaks parsing
 * is a sidebar running alongside the main flow, which is why Aurora and Navy are not marked safe.
 *
 * It is the European template to recommend for an online application.
 */
const TERRA = "#a9714b";
const TERRA_SOFT = "#c99b78";
const INK = "#2a2a2a";
const MUTED = "#5b5b5b";

export function TemplateTerracotta({
  data,
  placeholders: ph = false,
}: {
  data: ResumePayload;
  placeholders?: boolean;
}): ReactNode {
  const t = labelsFor(data);
  const contact = contactLines(data);
  const skills = flatSkills(data);
  const languages = languageLines(data);
  const interests = data.interests.filter((i) => i.trim().length > 0);

  return (
    <div style={{ ...SHEET, padding: "12mm 11mm", color: INK, fontFamily: SANS }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8mm",
          marginBottom: "5mm",
          ...AVOID_BREAK,
        }}
      >
        <Portrait url={data.photoUrl} size="30mm" placeholders={ph} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "22pt",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            <Ph value={properName(data.fullName)} label={t.phName} on={ph} />
          </h1>
          {data.title.trim() || ph ? (
            <p style={{ margin: "1.5mm 0 0", fontSize: "11pt", color: TERRA }}>
              <Ph value={capitalizeFirst(data.title)} label={t.phTitle} on={ph} />
            </p>
          ) : null}
        </div>
      </header>

      {showSection(contact.length > 0 || Boolean(data.drivingLicence?.trim()), ph) ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6mm",
            fontSize: "8.5pt",
            color: MUTED,
            marginBottom: "4mm",
            ...AVOID_BREAK,
          }}
        >
          {contact.length > 0
            ? contact.map((c) => (
                <span key={c.key}>
                  <ContactValue line={c} />
                </span>
              ))
            : [t.phEmail, t.phPhone, t.phLocation].map((label) => (
                <span key={label} style={{ opacity: 0.34 }} aria-hidden>
                  {label}
                </span>
              ))}
          {data.drivingLicence?.trim() ? <span>{capitalizeFirst(data.drivingLicence)}</span> : null}
        </div>
      ) : null}

      {showSection(Boolean(data.summary?.trim()), ph) ? (
        <div style={{ marginBottom: "6mm" }}>
          {data.summary?.trim() ? (
            <p style={{ margin: 0, fontSize: "9pt", lineHeight: 1.55, color: MUTED }}>
              {capitalizeSentences(data.summary)}
            </p>
          ) : (
            <GhostLines count={3} />
          )}
        </div>
      ) : null}

      {showSection(
        data.experiences.some((e) => e.title.trim()),
        ph,
      ) ? (
        <Section title={t.experience}>
          {data.experiences.every((e) => !e.title.trim()) ? <GhostLines count={5} /> : null}
          {data.experiences
            .filter((e) => e.title.trim())
            .map((e, i) => (
              <GutterRow
                key={i}
                dates={dateRange(data, e.startDate, e.endDate)}
                org={e.company}
                place={e.location}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "9pt",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {capitalizeFirst(e.title)}
                </p>
                <Bullets items={e.bullets} color={MUTED} size="8pt" />
              </GutterRow>
            ))}
        </Section>
      ) : null}

      {showSection(
        data.education.some((e) => e.degree.trim()),
        ph,
      ) ? (
        <Section title={t.education}>
          {data.education.every((e) => !e.degree.trim()) ? <GhostLines count={3} /> : null}
          {data.education
            .filter((e) => e.degree.trim())
            .map((e, i) => (
              <GutterRow
                key={i}
                dates={dateRange(data, e.startDate, e.endDate)}
                org={e.institution}
                place={e.location}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "9pt",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {capitalizeFirst(e.degree)}
                </p>
                {e.detail?.trim() ? (
                  <p style={{ margin: "1mm 0 0", fontSize: "8pt", color: MUTED }}>
                    {capitalizeSentences(e.detail)}
                  </p>
                ) : null}
              </GutterRow>
            ))}
        </Section>
      ) : null}

      {/**
       * The footer's three columns are three sequential sections in a grid, so a parser still reads them
       * in order. See the note at the top of this file.
       */}
      {showSection(languages.length > 0 || skills.length > 0 || interests.length > 0, ph) ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr 1fr",
            gap: "7mm",
            marginTop: "3mm",
            ...AVOID_BREAK,
          }}
        >
          <FooterColumn title={t.languages} items={languages} placeholders={ph} />
          <FooterColumn title={t.skills} items={skills} placeholders={ph} columns={2} />
          <FooterColumn title={t.interests} items={interests} placeholders={ph} />
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: "5mm" }}>
      <h2
        style={{
          margin: "0 0 3mm",
          fontSize: "12pt",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          color: TERRA,
          borderBottom: `0.3mm solid ${TERRA_SOFT}`,
          paddingBottom: "1.5mm",
          breakAfter: "avoid",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Dates in terracotta, employer bold beneath, substance on the right. */
function GutterRow({
  dates,
  org,
  place,
  children,
}: {
  dates: string;
  org: string | undefined;
  place: string | undefined;
  children: ReactNode;
}): ReactNode {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "36mm 1fr",
        gap: "5mm",
        marginBottom: "4mm",
        ...AVOID_BREAK,
      }}
    >
      <div style={{ fontSize: "8pt", lineHeight: 1.4 }}>
        {dates ? (
          <p style={{ margin: 0, color: TERRA, textTransform: "uppercase" }}>· {dates}</p>
        ) : null}
        {org?.trim() ? (
          <p style={{ margin: "1mm 0 0", fontWeight: 700, fontSize: "9pt" }}>
            {capitalizeFirst(org)}
          </p>
        ) : null}
        {place?.trim() ? <p style={{ margin: 0, color: MUTED }}>{capitalizeFirst(place)}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function FooterColumn({
  title,
  items,
  placeholders,
  columns = 1,
}: {
  title: string;
  items: string[];
  placeholders: boolean;
  columns?: number;
}): ReactNode {
  if (items.length === 0 && !placeholders) return null;

  return (
    <section>
      <h2
        style={{
          margin: "0 0 2.5mm",
          fontSize: "11pt",
          fontWeight: 700,
          textTransform: "uppercase",
          color: TERRA,
          breakAfter: "avoid",
        }}
      >
        {title}
      </h2>
      {items.length === 0 ? (
        <GhostLines count={3} />
      ) : (
        <ul
          style={{
            margin: 0,
            paddingLeft: "10pt",
            listStyle: "disc",
            fontSize: "8pt",
            color: MUTED,
            columnCount: columns,
            columnGap: "4mm",
          }}
        >
          {items.map((i) => (
            <li key={i} style={{ marginBottom: "1mm" }}>
              {i}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
