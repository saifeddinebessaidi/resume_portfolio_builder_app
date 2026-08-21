import { type ResumePayload } from "@repo/contracts";
import type { ReactNode } from "react";

import {
  AVOID_BREAK,
  Bullets,
  SANS,
  SHEET,
  contactLines,
  dateRange,
  flatSkills,
  GhostLines,
  Ph,
  languageLines,
  showSection,
  splitName,
} from "./template-parts";
import { capitalizeFirst, capitalizeSentences } from "@/lib/display-text";
import { labelsFor } from "./ats-template";

/**
 * **Timeline** — sidebar plus a vertical rail through the main column (the "Thomas Garcia" reference).
 *
 * Name across the top with the surname in the accent colour, a left sidebar for contact, skills and
 * languages, and a right column where each section hangs off a continuous vertical line with a round
 * icon badge at its head.
 *
 * ## The rail is one element, not one per entry
 *
 * A single absolutely-positioned line behind the column, with the badges painted over it. Drawing a
 * segment per section would leave visible seams wherever margins differ, and would break at page
 * boundaries in a way a continuous line does not.
 *
 * ## Not ATS-safe, deliberately
 *
 * Two columns means a naive parser reads the sidebar and the main column interleaved — "Négociation
 * avancée" landing in the middle of a job description. The picker labels this, and `ats` stays the
 * default. It is the right choice for a CV a human will open, which is most of them.
 */
const ACCENT = "#6f5b4e";
const INK = "#2b2b2b";
const MUTED = "#5f5f5f";

export function TemplateTimeline({
  data,
  placeholders: ph = false,
}: {
  data: ResumePayload;
  placeholders?: boolean;
}): ReactNode {
  const t = labelsFor(data);
  const { first, last } = splitName(data.fullName);
  const contact = contactLines(data);
  const skills = flatSkills(data);
  const languages = languageLines(data);

  return (
    <div style={{ ...SHEET, padding: "12mm 11mm", color: INK, fontFamily: SANS }}>
      {/* No portrait: North-American convention. See the note in `template-classic.tsx`. */}
      <header style={{ marginBottom: "6mm", ...AVOID_BREAK }}>
        <h1
          style={{
            margin: 0,
            fontSize: "27pt",
            fontWeight: 400,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {first || last ? (
            <>
              {first} <span style={{ fontWeight: 700, color: ACCENT }}>{last}</span>
            </>
          ) : (
            <Ph value="" label={t.phName} on={ph} />
          )}
        </h1>
        {data.title.trim() || ph ? (
          <p
            style={{
              margin: "4pt 0 0",
              fontSize: "10.5pt",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            <Ph value={capitalizeFirst(data.title)} label={t.phTitle} on={ph} />
          </p>
        ) : null}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "56mm 1fr", gap: "9mm" }}>
        {/* ---------------- sidebar ---------------- */}
        <aside>
          {showSection(contact.length > 0, ph) ? (
            <SideSection title={t.contact}>
              {/* Named rather than anonymous bars: "Téléphone" tells the user what the slot is for,
                  which a grey line cannot. The list sections below keep bars, because there the useful
                  information is how many rows the design expects, not what each one is called. */}
              {contact.length > 0
                ? contact.map((c) => (
                    <p
                      key={c.key}
                      style={{ margin: "0 0 3pt", fontSize: "8.5pt", lineHeight: 1.4 }}
                    >
                      {c.value}
                    </p>
                  ))
                : [t.phPhone, t.phEmail, t.phLocation].map((label) => (
                    <p
                      key={label}
                      style={{ margin: "0 0 3pt", fontSize: "8.5pt", opacity: 0.34 }}
                      aria-hidden
                    >
                      {label}
                    </p>
                  ))}
            </SideSection>
          ) : null}

          {showSection(skills.length > 0, ph) ? (
            <SideSection title={t.skills}>
              {skills.length === 0 ? <GhostLines count={4} /> : null}
              <ul style={{ margin: 0, paddingLeft: "10pt", listStyle: "disc", fontSize: "8.5pt" }}>
                {skills.map((s) => (
                  <li key={s} style={{ marginBottom: "2.5pt", lineHeight: 1.35 }}>
                    {s}
                  </li>
                ))}
              </ul>
            </SideSection>
          ) : null}

          {showSection(languages.length > 0, ph) ? (
            <SideSection title={t.languages}>
              {languages.length === 0 ? <GhostLines count={3} /> : null}
              <ul style={{ margin: 0, paddingLeft: "10pt", listStyle: "disc", fontSize: "8.5pt" }}>
                {languages.map((l) => (
                  <li key={l} style={{ marginBottom: "2.5pt" }}>
                    {l}
                  </li>
                ))}
              </ul>
            </SideSection>
          ) : null}
        </aside>

        {/* ---------------- main column, on the rail ---------------- */}
        <main style={{ position: "relative", paddingLeft: "9mm" }}>
          {/* The continuous rail. `bottom: 0` rather than a height, so it grows with the content. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "2.6mm",
              top: "3mm",
              bottom: 0,
              width: "0.4mm",
              background: "#d8d2cc",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          />

          {showSection(Boolean(data.summary?.trim()), ph) ? (
            <RailSection title={t.summary}>
              {data.summary?.trim() ? (
                <p style={{ margin: 0, fontSize: "9pt", lineHeight: 1.5, color: MUTED }}>
                  {capitalizeSentences(data.summary)}
                </p>
              ) : (
                <GhostLines count={3} />
              )}
            </RailSection>
          ) : null}

          {showSection(
            data.education.some((e) => e.degree.trim()),
            ph,
          ) ? (
            <RailSection title={t.education}>
              {data.education.every((e) => !e.degree.trim()) ? <GhostLines count={2} /> : null}
              {data.education
                .filter((e) => e.degree.trim())
                .map((e, i) => (
                  <div key={i} style={{ marginBottom: "5pt", ...AVOID_BREAK }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm" }}>
                      <strong style={{ fontSize: "9.5pt" }}>{capitalizeFirst(e.degree)}</strong>
                      <span style={{ fontSize: "8.5pt", color: MUTED, whiteSpace: "nowrap" }}>
                        {dateRange(data, e.startDate, e.endDate)}
                      </span>
                    </div>
                    {e.institution?.trim() || e.detail?.trim() ? (
                      <p style={{ margin: "1pt 0 0", fontSize: "8.5pt", color: MUTED }}>
                        {[capitalizeFirst(e.detail), capitalizeFirst(e.institution)]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    ) : null}
                  </div>
                ))}
            </RailSection>
          ) : null}

          {showSection(
            data.experiences.some((e) => e.title.trim()),
            ph,
          ) ? (
            <RailSection title={t.experience}>
              {data.experiences.every((e) => !e.title.trim()) ? <GhostLines count={5} /> : null}
              {data.experiences
                .filter((e) => e.title.trim())
                .map((e, i) => (
                  <div key={i} style={{ marginBottom: "6pt", ...AVOID_BREAK }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm" }}>
                      <strong style={{ fontSize: "9.5pt" }}>{capitalizeFirst(e.title)}</strong>
                      <span style={{ fontSize: "8.5pt", color: MUTED, whiteSpace: "nowrap" }}>
                        {dateRange(data, e.startDate, e.endDate)}
                      </span>
                    </div>
                    {e.company?.trim() ? (
                      <p
                        style={{
                          margin: "0.5pt 0 0",
                          fontSize: "8.5pt",
                          fontStyle: "italic",
                          color: MUTED,
                        }}
                      >
                        {[capitalizeFirst(e.company), e.companyNote].filter(Boolean).join(" ")}
                      </p>
                    ) : null}
                    <Bullets items={e.bullets} color={MUTED} size="8pt" />
                  </div>
                ))}
            </RailSection>
          ) : null}

          {data.projects.some((p) => p.title.trim()) ? (
            <RailSection title={t.projects}>
              {data.projects
                .filter((p) => p.title.trim())
                .map((p, i) => (
                  <div key={i} style={{ marginBottom: "5pt", ...AVOID_BREAK }}>
                    <strong style={{ fontSize: "9.5pt" }}>{capitalizeFirst(p.title)}</strong>
                    {p.technologies?.trim() ? (
                      <span style={{ fontSize: "8pt", color: MUTED }}> — {p.technologies}</span>
                    ) : null}
                    <Bullets items={p.bullets} color={MUTED} size="8pt" />
                  </div>
                ))}
            </RailSection>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: "7mm", ...AVOID_BREAK }}>
      <h2
        style={{
          margin: "0 0 3pt",
          fontSize: "10pt",
          fontWeight: 400,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          borderBottom: `0.5mm solid ${ACCENT}`,
          paddingBottom: "2pt",
        }}
      >
        {title}
      </h2>
      <div style={{ marginTop: "3pt", color: MUTED }}>{children}</div>
    </section>
  );
}

/** A section on the rail: the round badge sits over the line, level with the heading. */
function RailSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: "6mm", position: "relative" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "-9mm",
          top: "0.6mm",
          width: "5.2mm",
          height: "5.2mm",
          borderRadius: "50%",
          background: ACCENT,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      />
      <h2
        style={{
          margin: "0 0 4pt",
          fontSize: "11pt",
          fontWeight: 400,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          breakAfter: "avoid",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
