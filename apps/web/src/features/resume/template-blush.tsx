import { type ResumePayload } from "@repo/contracts";
import type { ReactNode } from "react";

import {
  AVOID_BREAK,
  Bullets,
  SANS,
  SERIF,
  SHEET,
  contactLines,
  dateRange,
  GhostLines,
  Ph,
  flatSkills,
  languageLines,
  showSection,
} from "./template-parts";
import { capitalizeFirst, capitalizeSentences, properName } from "@/lib/display-text";
import { labelsFor } from "./ats-template";

/**
 * **Blush** — tinted sidebar, serif display name, initials watermark (the "Sarah Amelia" reference).
 *
 * A centred serif name with wide tracking over a monogram set in a pale tint behind it, then a blush
 * panel down the left for contact, education and skills, with summary and experience on white.
 *
 * ## The monogram
 *
 * Derived from the name rather than stored: it is `S` + `A` for "Sarah Amelia", recomputed on every
 * render. A stored initials field would be one more thing to disagree with `fullName` after an edit, for
 * no benefit — nobody wants different initials from their own name.
 *
 * It sits at `z-index: 0` under the heading and is `aria-hidden`, so a screen reader and an ATS both
 * skip it. Printed at 8% opacity, with `printColorAdjust: exact` — without that the browser drops it and
 * the header loses the device the design is built around.
 *
 * ## Not ATS-safe
 *
 * Two columns, same caveat as Timeline: a parser interleaves the sidebar with the main column. This is
 * the design for a CV that goes to a person by email.
 */
const BLUSH = "#f6e7e7";
const BLUSH_DEEP = "#c98f8f";
const INK = "#2f2b2b";
const MUTED = "#6d6565";

export function TemplateBlush({
  data,
  placeholders: ph = false,
}: {
  data: ResumePayload;
  placeholders?: boolean;
}): ReactNode {
  const t = labelsFor(data);
  const name = properName(data.fullName);
  const contact = contactLines(data);
  const skills = flatSkills(data);
  const languages = languageLines(data);

  const monogram = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <div style={{ ...SHEET, padding: "9mm", color: INK, fontFamily: SANS }}>
      <div
        style={{
          border: `0.3mm solid ${BLUSH}`,
          borderRadius: "4mm",
          overflow: "hidden",
          minHeight: "279mm",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <header
          style={{
            position: "relative",
            textAlign: "center",
            padding: "9mm 8mm 6mm",
            ...AVOID_BREAK,
          }}
        >
          {/* No portrait: North-American convention. The monogram is this design's device instead. */}
          {monogram ? (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: "2mm",
                left: "50%",
                transform: "translateX(-30%)",
                fontFamily: SERIF,
                fontSize: "46pt",
                fontStyle: "italic",
                color: BLUSH_DEEP,
                opacity: 0.28,
                zIndex: 0,
                userSelect: "none",
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              }}
            >
              {monogram}
            </span>
          ) : null}

          <h1
            style={{
              position: "relative",
              zIndex: 1,
              margin: 0,
              fontFamily: SERIF,
              fontSize: "24pt",
              fontWeight: 400,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
            }}
          >
            <Ph value={name} label={t.phName} on={ph} />
          </h1>
          {data.title.trim() || ph ? (
            <p
              style={{
                position: "relative",
                zIndex: 1,
                margin: "3pt 0 0",
                fontSize: "10pt",
                letterSpacing: "0.34em",
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              <Ph value={capitalizeFirst(data.title)} label={t.phTitle} on={ph} />
            </p>
          ) : null}
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "62mm 1fr", minHeight: "230mm" }}>
          {/* ---------------- tinted sidebar ---------------- */}
          <aside
            style={{
              background: BLUSH,
              padding: "8mm 6mm",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            {showSection(contact.length > 0, ph) ? (
              <SideSection title={t.contact}>
                {/* Named, for the same reason as Timeline's sidebar. */}
                {contact.length > 0
                  ? contact.map((c) => (
                      <p
                        key={c.key}
                        style={{ margin: "0 0 3pt", fontSize: "8.5pt", lineHeight: 1.45 }}
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

            {showSection(
              data.education.some((e) => e.degree.trim()),
              ph,
            ) ? (
              <SideSection title={t.education}>
                {data.education.every((e) => !e.degree.trim()) ? <GhostLines count={2} /> : null}
                {data.education
                  .filter((e) => e.degree.trim())
                  .map((e, i) => (
                    <div key={i} style={{ marginBottom: "5pt", ...AVOID_BREAK }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "8.5pt",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {capitalizeFirst(e.degree)}
                      </p>
                      {e.institution?.trim() ? (
                        <p style={{ margin: "1pt 0 0", fontSize: "8pt", color: MUTED }}>
                          {capitalizeFirst(e.institution)}
                        </p>
                      ) : null}
                      <p style={{ margin: "0.5pt 0 0", fontSize: "8pt", color: MUTED }}>
                        {dateRange(data, e.startDate, e.endDate)}
                      </p>
                    </div>
                  ))}
              </SideSection>
            ) : null}

            {showSection(skills.length > 0, ph) ? (
              <SideSection title={t.skills}>
                {skills.length === 0 ? <GhostLines count={4} /> : null}
                {skills.map((s) => (
                  <p key={s} style={{ margin: "0 0 2.5pt", fontSize: "8.5pt", color: MUTED }}>
                    {s}
                  </p>
                ))}
              </SideSection>
            ) : null}

            {showSection(languages.length > 0, ph) ? (
              <SideSection title={t.languages}>
                {languages.length === 0 ? <GhostLines count={3} /> : null}
                {languages.map((l) => (
                  <p key={l} style={{ margin: "0 0 2.5pt", fontSize: "8.5pt", color: MUTED }}>
                    {l}
                  </p>
                ))}
              </SideSection>
            ) : null}
          </aside>

          {/* ---------------- main column ---------------- */}
          <main style={{ padding: "8mm 7mm" }}>
            {showSection(Boolean(data.summary?.trim()), ph) ? (
              <MainSection title={t.summary}>
                {data.summary?.trim() ? (
                  <p style={{ margin: 0, fontSize: "9pt", lineHeight: 1.55, color: MUTED }}>
                    {capitalizeSentences(data.summary)}
                  </p>
                ) : (
                  <GhostLines count={4} />
                )}
              </MainSection>
            ) : null}

            {showSection(
              data.experiences.some((e) => e.title.trim()),
              ph,
            ) ? (
              <MainSection title={t.experience}>
                {data.experiences.every((e) => !e.title.trim()) ? <GhostLines count={5} /> : null}
                {data.experiences
                  .filter((e) => e.title.trim())
                  .map((e, i) => (
                    <div key={i} style={{ marginBottom: "6pt", ...AVOID_BREAK }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "9.5pt",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {capitalizeFirst(e.title)}
                      </p>
                      {e.company?.trim() ? (
                        <p style={{ margin: "1pt 0 0", fontSize: "8.5pt", color: MUTED }}>
                          {[capitalizeFirst(e.company), e.companyNote].filter(Boolean).join(" ")}
                        </p>
                      ) : null}
                      <p style={{ margin: "0.5pt 0 0", fontSize: "8pt", color: MUTED }}>
                        {dateRange(data, e.startDate, e.endDate)}
                      </p>
                      <Bullets items={e.bullets} color={MUTED} size="8pt" />
                    </div>
                  ))}
              </MainSection>
            ) : null}

            {data.projects.some((p) => p.title.trim()) ? (
              <MainSection title={t.projects}>
                {data.projects
                  .filter((p) => p.title.trim())
                  .map((p, i) => (
                    <div key={i} style={{ marginBottom: "5pt", ...AVOID_BREAK }}>
                      <p style={{ margin: 0, fontSize: "9.5pt", fontWeight: 700 }}>
                        {capitalizeFirst(p.title)}
                      </p>
                      {p.description?.trim() ? (
                        <p style={{ margin: "1pt 0 0", fontSize: "8pt", color: MUTED }}>
                          {capitalizeSentences(p.description)}
                        </p>
                      ) : null}
                      <Bullets items={p.bullets} color={MUTED} size="8pt" />
                    </div>
                  ))}
              </MainSection>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: "7mm", ...AVOID_BREAK }}>
      <h2
        style={{
          margin: "0 0 4pt",
          fontSize: "9.5pt",
          fontWeight: 700,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function MainSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: "7mm" }}>
      <h2
        style={{
          margin: "0 0 4pt",
          fontSize: "10pt",
          fontWeight: 700,
          letterSpacing: "0.24em",
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
