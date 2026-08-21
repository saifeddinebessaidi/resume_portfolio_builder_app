import { type ResumePayload } from "@repo/contracts";
import type { ReactNode } from "react";

import {
  AVOID_BREAK,
  Bullets,
  GhostLines,
  Ph,
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
 * **Classic** — the single-column, rule-separated layout (the "Anaisha Parvati" reference).
 *
 * Centred name over a letter-spaced job title, a bordered contact strip, then sections divided by full
 * width hairlines. Education and experience use a **date gutter**: dates and employer on the left, the
 * substance on the right, which is the convention a North-American recruiter scans down.
 *
 * ## Why this one is `atsSafe`
 *
 * It is one column, so a parser reading the page top-to-bottom sees the same order a human does — the
 * property the two-column designs give up for looks. It is the template to recommend to someone applying
 * through a job board rather than emailing a person.
 *
 * Skills render as a multi-column *grid of a single list*, not as parallel columns of content: the DOM
 * order stays linear, so `column-count` is a visual wrap rather than a structural split.
 */
export function TemplateClassic({
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

  return (
    <div style={{ ...SHEET, padding: "12mm", color: "#1a1a1a", fontFamily: SANS }}>
      {/* A hairline frame, inset from the trim — the reference's own device. */}
      <div style={{ border: "1px solid #c9ccd1", padding: "9mm 8mm", minHeight: "273mm" }}>
        {/**
         * **No portrait.** A North-American résumé does not carry one, so this template has no slot for
         * it even when `photoUrl` holds a URL. Switching a CV from a European design to this one *hides*
         * the photo rather than discarding it — the value stays in the payload, so switching back
         * restores it.
         */}
        <header style={{ textAlign: "center", marginBottom: "6pt", ...AVOID_BREAK }}>
          <h1
            style={{
              margin: 0,
              fontSize: "26pt",
              fontWeight: 700,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color: "#16202e",
            }}
          >
            <Ph value={properName(data.fullName)} label={t.phName} on={ph} />
          </h1>
          {data.title.trim() || ph ? (
            <p
              style={{
                margin: "3pt 0 0",
                fontSize: "10.5pt",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#4a5464",
              }}
            >
              <Ph value={capitalizeFirst(data.title)} label={t.phTitle} on={ph} />
            </p>
          ) : null}
        </header>

        {showSection(contact.length > 0, ph) ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "4mm",
              borderTop: "1px solid #c9ccd1",
              borderBottom: "1px solid #c9ccd1",
              padding: "4pt 0",
              fontSize: "9pt",
              color: "#33404f",
              ...AVOID_BREAK,
            }}
          >
            {contact.length > 0
              ? contact.map((c) => <span key={c.key}>{c.value}</span>)
              : [t.phPhone, t.phEmail, t.phLocation].map((label) => (
                  <span key={label} style={{ opacity: 0.34 }} aria-hidden>
                    {label}
                  </span>
                ))}
          </div>
        ) : null}

        {showSection(Boolean(data.summary?.trim()), ph) ? (
          <Section title={t.summary}>
            {data.summary?.trim() ? (
              <p style={{ margin: 0, fontSize: "9.5pt", lineHeight: 1.5, color: "#33404f" }}>
                {capitalizeSentences(data.summary)}
              </p>
            ) : (
              <GhostLines count={3} />
            )}
          </Section>
        ) : null}

        {showSection(
          data.education.some((e) => e.degree.trim()),
          ph,
        ) ? (
          <Section title={t.education}>
            {data.education.every((e) => !e.degree.trim()) ? <GhostLines count={2} /> : null}
            {data.education
              .filter((e) => e.degree.trim())
              .map((e, i) => (
                <GutterRow
                  key={i}
                  left={
                    <>
                      <div>{dateRange(data, e.startDate, e.endDate)}</div>
                      {e.institution?.trim() ? (
                        <div style={{ color: "#6b7686" }}>{capitalizeFirst(e.institution)}</div>
                      ) : null}
                    </>
                  }
                >
                  <strong style={{ fontSize: "10pt" }}>{capitalizeFirst(e.degree)}</strong>
                  {e.detail?.trim() ? (
                    <p style={{ margin: "1.5pt 0 0", fontSize: "8.5pt", lineHeight: 1.4 }}>
                      {capitalizeSentences(e.detail)}
                    </p>
                  ) : null}
                </GutterRow>
              ))}
          </Section>
        ) : null}

        {showSection(
          data.experiences.some((e) => e.title.trim()),
          ph,
        ) ? (
          <Section title={t.experience}>
            {data.experiences.every((e) => !e.title.trim()) ? <GhostLines count={4} /> : null}
            {data.experiences
              .filter((e) => e.title.trim())
              .map((e, i) => (
                <GutterRow
                  key={i}
                  left={
                    <>
                      <div>{dateRange(data, e.startDate, e.endDate)}</div>
                      {e.company?.trim() ? (
                        <div style={{ color: "#6b7686" }}>{capitalizeFirst(e.company)}</div>
                      ) : null}
                    </>
                  }
                >
                  <strong style={{ fontSize: "10pt" }}>{capitalizeFirst(e.title)}</strong>
                  <Bullets items={e.bullets} />
                </GutterRow>
              ))}
          </Section>
        ) : null}

        {showSection(skills.length > 0, ph) ? (
          <Section title={t.skills}>
            {/* `columnCount` wraps ONE list into four columns. The DOM order stays linear, so a parser
                still reads the skills in sequence — a real four-column grid would not. */}
            {skills.length === 0 ? <GhostLines count={2} /> : null}
            <ul
              style={{
                margin: 0,
                paddingLeft: "11pt",
                columnCount: 4,
                columnGap: "6mm",
                listStyle: "disc",
                fontSize: "9pt",
                color: "#33404f",
              }}
            >
              {skills.map((s) => (
                <li key={s} style={{ marginBottom: "1.5pt" }}>
                  {s}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {showSection(languages.length > 0, ph) ? (
          <Section title={t.languages}>
            {languages.length > 0 ? (
              <p style={{ margin: 0, fontSize: "9pt", color: "#33404f" }}>
                {languages.join("   ·   ")}
              </p>
            ) : (
              <GhostLines count={1} width="46%" />
            )}
          </Section>
        ) : null}

        {data.projects.some((p) => p.title.trim()) ? (
          <Section title={t.projects}>
            {data.projects
              .filter((p) => p.title.trim())
              .map((p, i) => (
                <div key={i} style={{ marginBottom: "5pt", ...AVOID_BREAK }}>
                  <strong style={{ fontSize: "10pt" }}>{capitalizeFirst(p.title)}</strong>
                  {p.technologies?.trim() ? (
                    <span style={{ fontSize: "8.5pt", color: "#6b7686" }}> — {p.technologies}</span>
                  ) : null}
                  {p.description?.trim() ? (
                    <p style={{ margin: "1.5pt 0 0", fontSize: "8.5pt", lineHeight: 1.4 }}>
                      {capitalizeSentences(p.description)}
                    </p>
                  ) : null}
                  <Bullets items={p.bullets} />
                </div>
              ))}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginTop: "7pt" }}>
      <h2
        style={{
          margin: "0 0 4pt",
          fontSize: "11.5pt",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          borderBottom: "1.5px solid #16202e",
          paddingBottom: "2pt",
          color: "#16202e",
          // A heading must never be the last thing on a page.
          breakAfter: "avoid",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Dates and employer in a fixed left gutter, substance on the right. */
function GutterRow({ left, children }: { left: ReactNode; children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "34mm 1fr",
        gap: "5mm",
        marginBottom: "5pt",
        ...AVOID_BREAK,
      }}
    >
      <div style={{ fontSize: "8.5pt", color: "#33404f", lineHeight: 1.35 }}>{left}</div>
      <div style={{ color: "#33404f" }}>{children}</div>
    </div>
  );
}
