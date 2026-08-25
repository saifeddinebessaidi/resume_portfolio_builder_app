import { type ResumePayload } from "@repo/contracts";
import type { ReactNode } from "react";

import {
  AVOID_BREAK,
  Bullets,
  ContactValue,
  GhostLines,
  Ph,
  SANS,
  SHEET,
  contactLines,
  dateRange,
  languageLines,
  showSection,
  splitName,
} from "./template-parts";
import { capitalizeFirst, capitalizeSentences } from "@/lib/display-text";
import { labelsFor } from "./ats-template";

/**
 * **Navy** — dark sidebar with a full-bleed photo (the "Thomas Garcia" reference).
 *
 * A deep navy column down the left carrying the portrait at its full width, then PROFIL, CONTACT and
 * INTÉRÊTS reversed out in white. The right column is white: name, letter-spaced job title, then
 * FORMATION, EXPÉRIENCE and COMPÉTENCES.
 *
 * ## The photo is not a circle here
 *
 * It fills the sidebar's width edge-to-edge, which is the design's strongest gesture. So this template
 * does not use the shared `Portrait` component — that one is a fixed circle by contract, and forcing a
 * square through it would mean a prop that means "actually, ignore the shape". A local `<img>` with
 * `objectFit: cover` is the honest way to say a different thing.
 *
 * ## Printing a dark panel
 *
 * `printColorAdjust: exact` is doing real work here: without it the browser drops the navy background and
 * prints **white text on white paper**. That is not a cosmetic degradation — half the CV disappears — so
 * the sidebar sets it on itself rather than relying on an ancestor.
 *
 * ## COMPÉTENCES is two sub-columns
 *
 * The reference splits it into LANGUES and LOGICIELS MAÎTRISÉS. Languages come from `data.languages`; the
 * second column is the user's own **skill groups**, whose `heading` the other templates discard. Here the
 * heading is the point, so a group named "Logiciels maîtrisés" renders exactly as the reference shows.
 */
const NAVY = "#2c3d51";
const INK = "#1f1f1f";
const MUTED = "#5a5a5a";

export function TemplateNavy({
  data,
  placeholders: ph = false,
}: {
  data: ResumePayload;
  placeholders?: boolean;
}): ReactNode {
  const t = labelsFor(data);
  const { first, last } = splitName(data.fullName);
  const contact = contactLines(data);
  const languages = languageLines(data);
  const interests = data.interests.filter((i) => i.trim().length > 0);
  const skillGroups = data.skills.filter((g) => g.items.some((i) => i.trim().length > 0));

  return (
    <div style={{ ...SHEET, color: INK, fontFamily: SANS }}>
      <div style={{ display: "grid", gridTemplateColumns: "72mm 1fr", minHeight: "297mm" }}>
        {/* ---------------- navy sidebar ---------------- */}
        <aside
          style={{
            background: NAVY,
            color: "#fff",
            // Without this the panel prints white and so does its text. See the note above.
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          }}
        >
          {/* Full-bleed portrait: no padding above or beside it. */}
          {data.photoUrl ? (
            <img
              src={data.photoUrl}
              alt=""
              style={{ width: "100%", height: "78mm", objectFit: "cover", display: "block" }}
            />
          ) : ph ? (
            <span
              aria-hidden
              style={{
                display: "block",
                width: "100%",
                height: "78mm",
                background: "rgba(255,255,255,0.08)",
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              }}
            />
          ) : null}

          <div style={{ padding: "10mm 8mm" }}>
            {showSection(Boolean(data.summary?.trim()), ph) ? (
              <SideSection title={t.summary}>
                {data.summary?.trim() ? (
                  <p style={{ margin: 0, fontSize: "8.5pt", lineHeight: 1.5, textAlign: "center" }}>
                    {capitalizeSentences(data.summary)}
                  </p>
                ) : (
                  <GhostLines count={4} />
                )}
              </SideSection>
            ) : null}

            {showSection(contact.length > 0 || Boolean(data.drivingLicence?.trim()), ph) ? (
              <SideSection title={t.contact}>
                {contact.length > 0
                  ? contact.map((c) => (
                      <p key={c.key} style={{ margin: "0 0 2.5mm", fontSize: "8.5pt" }}>
                        <ContactValue line={c} />
                      </p>
                    ))
                  : [t.phPhone, t.phEmail, t.phLocation].map((label) => (
                      <p
                        key={label}
                        style={{ margin: "0 0 2.5mm", fontSize: "8.5pt", opacity: 0.5 }}
                        aria-hidden
                      >
                        {label}
                      </p>
                    ))}
                {/* Permis sits with contact, as the reference has it. */}
                {data.drivingLicence?.trim() ? (
                  <p style={{ margin: "0 0 2.5mm", fontSize: "8.5pt" }}>
                    {capitalizeFirst(data.drivingLicence)}
                  </p>
                ) : null}
              </SideSection>
            ) : null}

            {showSection(interests.length > 0, ph) ? (
              <SideSection title={t.interests}>
                {interests.length > 0 ? (
                  interests.map((i) => (
                    <p key={i} style={{ margin: "0 0 2mm", fontSize: "8.5pt" }}>
                      {capitalizeFirst(i)}
                    </p>
                  ))
                ) : (
                  <GhostLines count={3} />
                )}
              </SideSection>
            ) : null}
          </div>
        </aside>

        {/* ---------------- white main column ---------------- */}
        <main style={{ padding: "16mm 12mm 12mm 10mm" }}>
          <header style={{ marginBottom: "10mm", ...AVOID_BREAK }}>
            <h1 style={{ margin: 0, fontSize: "30pt", fontWeight: 400, color: NAVY }}>
              {first || last ? (
                <>
                  {first} {last}
                </>
              ) : (
                <Ph value="" label={t.phName} on={ph} />
              )}
            </h1>
            {data.title.trim() || ph ? (
              <p
                style={{
                  margin: "2mm 0 0",
                  fontSize: "11pt",
                  letterSpacing: "0.42em",
                  textTransform: "uppercase",
                  color: MUTED,
                }}
              >
                <Ph value={capitalizeFirst(data.title)} label={t.phTitle} on={ph} />
              </p>
            ) : null}
          </header>

          {showSection(
            data.education.some((e) => e.degree.trim()),
            ph,
          ) ? (
            <MainSection title={t.education}>
              {data.education.every((e) => !e.degree.trim()) ? <GhostLines count={3} /> : null}
              {data.education
                .filter((e) => e.degree.trim())
                .map((e, i) => (
                  <p key={i} style={{ margin: "0 0 2mm", fontSize: "9pt", ...AVOID_BREAK }}>
                    <strong>{dateRange(data, e.startDate, e.endDate)}</strong>
                    {" — "}
                    {capitalizeFirst(e.degree)}
                    {e.institution?.trim() ? ` — ${capitalizeFirst(e.institution)}` : ""}
                  </p>
                ))}
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
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "26mm 1fr",
                      gap: "4mm",
                      marginBottom: "4mm",
                      ...AVOID_BREAK,
                    }}
                  >
                    <div style={{ fontSize: "8.5pt", color: MUTED }}>
                      <div>{dateRange(data, e.startDate, e.endDate)}</div>
                      {e.company?.trim() ? (
                        <div style={{ fontWeight: 700, color: INK }}>
                          {capitalizeFirst(e.company)}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "9pt",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {capitalizeFirst(e.title)}
                      </p>
                      <Bullets items={e.bullets} color={MUTED} size="8pt" />
                    </div>
                  </div>
                ))}
            </MainSection>
          ) : null}

          {showSection(languages.length > 0 || skillGroups.length > 0, ph) ? (
            <MainSection title={t.skills}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8mm" }}>
                <div>
                  <p style={{ margin: "0 0 2mm", fontSize: "9pt", fontWeight: 700 }}>
                    {t.languages}
                  </p>
                  {languages.length > 0 ? (
                    languages.map((l) => (
                      <p key={l} style={{ margin: "0 0 1.5mm", fontSize: "8.5pt", color: MUTED }}>
                        {l}
                      </p>
                    ))
                  ) : (
                    <GhostLines count={3} />
                  )}
                </div>

                <div>
                  {skillGroups.length > 0 ? (
                    skillGroups.map((g) => (
                      <div key={g.heading} style={{ marginBottom: "3mm" }}>
                        <p style={{ margin: "0 0 2mm", fontSize: "9pt", fontWeight: 700 }}>
                          {capitalizeFirst(g.heading) || t.skills}
                        </p>
                        {g.items
                          .filter((i) => i.trim())
                          .map((i) => (
                            <p
                              key={i}
                              style={{ margin: "0 0 1.5mm", fontSize: "8.5pt", color: MUTED }}
                            >
                              {capitalizeFirst(i)}
                            </p>
                          ))}
                      </div>
                    ))
                  ) : (
                    <GhostLines count={3} />
                  )}
                </div>
              </div>
            </MainSection>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section style={{ marginBottom: "9mm", textAlign: "center", ...AVOID_BREAK }}>
      <h2
        style={{
          margin: "0 0 3mm",
          fontSize: "10pt",
          fontWeight: 400,
          letterSpacing: "0.3em",
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
    <section style={{ marginBottom: "8mm" }}>
      <h2
        style={{
          margin: "0 0 1mm",
          fontSize: "12pt",
          fontWeight: 400,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: NAVY,
          breakAfter: "avoid",
        }}
      >
        {title}
      </h2>
      <span
        aria-hidden
        style={{
          display: "block",
          width: "14mm",
          height: "0.5mm",
          background: NAVY,
          margin: "0 0 4mm",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      />
      {children}
    </section>
  );
}
