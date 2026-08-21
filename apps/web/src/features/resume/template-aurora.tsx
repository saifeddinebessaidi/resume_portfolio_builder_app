import { type ResumePayload } from "@repo/contracts";
import type { ReactNode } from "react";

import {
  AVOID_BREAK,
  Bullets,
  GhostLines,
  Ph,
  Portrait,
  SANS,
  SERIF,
  SHEET,
  contactLines,
  dateRange,
  flatSkills,
  languageLines,
  showSection,
} from "./template-parts";
import { capitalizeFirst, properName } from "@/lib/display-text";
import { labelsFor } from "./ats-template";

/**
 * **Aurora** — cream panel with a curved edge, serif display name, skills as chips (the "Célia Naudin"
 * reference).
 *
 * A full-height beige panel down the left with a **convex right edge**, a circular portrait sitting at
 * its top, and a large two-line serif name on the right. Section headings on the right are each preceded
 * by a four-point star on a vertical rule.
 *
 * ## The curve
 *
 * `border-radius: 0 40% 40% 0 / 0 50% 50% 0` on the panel — an elliptical corner radius, which is what
 * produces one continuous bow rather than two rounded corners with a straight run between them. An SVG
 * path would be more exact but would not stretch with the panel's height, and the panel grows with the
 * sidebar's content.
 *
 * ## Centred sidebar, no headings on contact
 *
 * The reference gives contact no heading at all — just icons and values, centred. That is a real design
 * decision and it is kept: a "CONTACT" label above three obviously-contact lines is noise the layout is
 * better without.
 */
const CREAM = "#e8e0d3";
const CREAM_DEEP = "#d5c9b6";
const INK = "#1c1c1c";
const MUTED = "#4a4a4a";

export function TemplateAurora({
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
    <div style={{ ...SHEET, color: INK, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "68mm 1fr", minHeight: "297mm" }}>
        {/* ---------------- cream panel, curved right edge ---------------- */}
        <aside
          style={{
            background: CREAM,
            // Elliptical radius: one continuous bow that scales with the panel's height.
            borderRadius: "0 42% 42% 0 / 0 50% 50% 0",
            padding: "14mm 9mm 12mm",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "9mm",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          }}
        >
          <Portrait url={data.photoUrl} size="38mm" placeholders={ph} />

          {showSection(contact.length > 0, ph) ? (
            <div style={{ textAlign: "center", fontSize: "8.5pt", color: MUTED, lineHeight: 1.6 }}>
              {contact.length > 0
                ? contact.map((c) => (
                    <p key={c.key} style={{ margin: "0 0 4mm" }}>
                      {c.value}
                    </p>
                  ))
                : [t.phPhone, t.phEmail, t.phLocation].map((label) => (
                    <p key={label} style={{ margin: "0 0 4mm", opacity: 0.34 }} aria-hidden>
                      {label}
                    </p>
                  ))}
            </div>
          ) : null}

          {showSection(languages.length > 0, ph) ? (
            <PanelSection title={t.languages}>
              {languages.length > 0 ? (
                languages.map((l) => (
                  <p key={l} style={{ margin: "0 0 1.5mm" }}>
                    {l}
                  </p>
                ))
              ) : (
                <GhostLines count={3} width="34mm" />
              )}
            </PanelSection>
          ) : null}

          {showSection(interests.length > 0, ph) ? (
            <PanelSection title={t.interests}>
              {interests.length > 0 ? (
                interests.map((i) => (
                  <p key={i} style={{ margin: "0 0 1.5mm" }}>
                    {capitalizeFirst(i)}
                  </p>
                ))
              ) : (
                <GhostLines count={3} width="34mm" />
              )}
            </PanelSection>
          ) : null}
        </aside>

        {/* ---------------- main column ---------------- */}
        <main style={{ padding: "14mm 12mm 12mm 4mm", position: "relative" }}>
          <header style={{ textAlign: "right", marginBottom: "10mm", ...AVOID_BREAK }}>
            <h1
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: "34pt",
                fontWeight: 400,
                lineHeight: 1.02,
                letterSpacing: "-0.01em",
              }}
            >
              <Ph value={properName(data.fullName)} label={t.phName} on={ph} />
            </h1>
            {data.title.trim() || ph ? (
              <p style={{ margin: "2mm 0 0", fontSize: "12pt", color: MUTED }}>
                <Ph value={capitalizeFirst(data.title)} label={t.phTitle} on={ph} />
              </p>
            ) : null}
          </header>

          {/* The rule the stars sit on. */}
          <div style={{ position: "relative", paddingLeft: "8mm" }}>
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: "2mm",
                bottom: "2mm",
                width: "0.3mm",
                background: CREAM_DEEP,
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              }}
            />

            {showSection(
              data.experiences.some((e) => e.title.trim()),
              ph,
            ) ? (
              <StarSection title={t.experience}>
                {data.experiences.every((e) => !e.title.trim()) ? <GhostLines count={5} /> : null}
                {data.experiences
                  .filter((e) => e.title.trim())
                  .map((e, i) => (
                    <div key={i} style={{ marginBottom: "5mm", ...AVOID_BREAK }}>
                      <p style={{ margin: 0, fontSize: "10pt", fontWeight: 700 }}>
                        {[capitalizeFirst(e.company), dateRange(data, e.startDate, e.endDate)]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <p style={{ margin: "0.5mm 0 0", fontSize: "9.5pt", fontStyle: "italic" }}>
                        {capitalizeFirst(e.title)}
                      </p>
                      <Bullets items={e.bullets} color={MUTED} size="8.5pt" />
                    </div>
                  ))}
              </StarSection>
            ) : null}

            {showSection(
              data.education.some((e) => e.degree.trim()),
              ph,
            ) ? (
              <StarSection title={t.education}>
                {data.education.every((e) => !e.degree.trim()) ? <GhostLines count={2} /> : null}
                {data.education
                  .filter((e) => e.degree.trim())
                  .map((e, i) => (
                    <div key={i} style={{ marginBottom: "4mm", ...AVOID_BREAK }}>
                      <p style={{ margin: 0, fontSize: "10pt", fontWeight: 700 }}>
                        {[capitalizeFirst(e.institution), dateRange(data, e.startDate, e.endDate)]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <p style={{ margin: "0.5mm 0 0", fontSize: "9.5pt", fontStyle: "italic" }}>
                        {capitalizeFirst(e.degree)}
                      </p>
                      {e.detail?.trim() ? (
                        <p
                          style={{ margin: 0, fontSize: "9pt", fontStyle: "italic", color: MUTED }}
                        >
                          {capitalizeFirst(e.detail)}
                        </p>
                      ) : null}
                    </div>
                  ))}
              </StarSection>
            ) : null}

            {showSection(skills.length > 0, ph) ? (
              <StarSection title={t.skills}>
                {skills.length === 0 ? (
                  <GhostLines count={2} />
                ) : (
                  /* Chips in a two-column grid, as the reference has them. */
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "3mm",
                      marginTop: "1mm",
                    }}
                  >
                    {skills.map((s) => (
                      <span
                        key={s}
                        style={{
                          background: CREAM,
                          borderRadius: "2mm",
                          padding: "2mm 3mm",
                          fontSize: "8.5pt",
                          textAlign: "center",
                          WebkitPrintColorAdjust: "exact",
                          printColorAdjust: "exact",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </StarSection>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ textAlign: "center", ...AVOID_BREAK }}>
      <h2 style={{ margin: "0 0 2mm", fontSize: "13pt", fontWeight: 400 }}>{title}</h2>
      <div style={{ fontSize: "8.5pt", color: MUTED, lineHeight: 1.5 }}>{children}</div>
    </section>
  );
}

/** A heading with the reference's four-point star sitting on the vertical rule. */
function StarSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: "8mm", position: "relative" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "-9.4mm",
          top: "0.4mm",
          fontSize: "12pt",
          lineHeight: 1,
          color: INK,
        }}
      >
        ✦
      </span>
      <h2 style={{ margin: "0 0 3mm", fontSize: "14pt", fontWeight: 400, breakAfter: "avoid" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
