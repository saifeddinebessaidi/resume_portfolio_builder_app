import { type ResumePayload } from "@repo/contracts";
import type { CSSProperties, ReactNode } from "react";

import { capitalizeFirst, capitalizeSentences, properName } from "@/lib/display-text";
import { labelsFor } from "./ats-template";

/**
 * Shared machinery for the **designed** templates.
 *
 * ## Why these render a component tree, not `ResumeBlock[]`
 *
 * The ATS layout builds a flat list of blocks so a paginator can decide page breaks between individual
 * bullets. That model cannot express a two-column design at all — a sidebar is not a point in a linear
 * flow — so the designed templates render real markup and hand pagination to the browser's own print
 * engine via `break-inside: avoid`. That is available to us precisely because ADR-0011 chose
 * `window.print()` over a server-side renderer.
 *
 * ## Print-safety rules every template here follows
 *
 * - **`mm` and `pt`, never `rem`.** The sheet is a physical page; `rem` depends on a root font size the
 *   print stylesheet may not inherit.
 * - **`printColorAdjust: "exact"` on anything with a background.** Browsers strip backgrounds when
 *   printing by default, and a template whose entire identity is a coloured sidebar would print as a
 *   blank margin.
 * - **`breakInside: "avoid"` on every entry.** A job split across a page boundary mid-title is the one
 *   layout failure a reader always notices.
 * - **No webfont.** Georgia and Arial are on every machine that will ever print this. A template that
 *   waits on a font risks being measured with the fallback and re-flowing after `window.print()` fires.
 */

/** A4 at real dimensions, shared by every template so preview and print agree. */
export const SHEET: CSSProperties = {
  position: "relative",
  width: "210mm",
  minHeight: "297mm",
  background: "#fff",
  boxSizing: "border-box",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
};

export const AVOID_BREAK: CSSProperties = { breakInside: "avoid" };

export const SANS = "Arial, Helvetica, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', serif";

/**
 * The contact lines, in the order every one of these designs shows them.
 *
 * Returned as data rather than markup because each template decorates them differently — icons in a
 * sidebar, a centred row, a bordered strip — and only the *selection and order* is shared.
 */
export function contactLines(data: ResumePayload): { key: string; value: string }[] {
  return [
    { key: "phone", value: data.phone ?? "" },
    { key: "email", value: data.email },
    { key: "location", value: data.location ?? "" },
    { key: "website", value: data.website ?? "" },
    { key: "linkedin", value: data.linkedin ?? "" },
  ].filter((l) => l.value.trim().length > 0);
}

/** Splits a full name so a template can weight the surname differently, as two of the three designs do. */
export function splitName(fullName: string): { first: string; last: string } {
  const parts = properName(fullName).trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) ?? "" };
}

/** `"2020"` + `""` → `"2020 – Présent"`, in the CV's own language. */
export function dateRange(
  data: ResumePayload,
  start: string | undefined,
  end: string | undefined,
): string {
  const t = labelsFor(data);
  const from = (start ?? "").trim();
  const to = (end ?? "").trim();
  if (!from && !to) return "";
  return [from, to.length > 0 ? to : t.present].filter(Boolean).join(" – ");
}

/** Bullet list, capitalised per sentence, with the empty entries the editor allows filtered out. */
export function Bullets({
  items,
  color = "#333",
  size = "8.5pt",
}: {
  items: string[];
  color?: string;
  size?: string;
}): ReactNode {
  const kept = items.filter((b) => b.trim().length > 0);
  if (kept.length === 0) return null;

  return (
    <ul
      style={{ margin: "2pt 0 0", paddingLeft: "11pt", listStyle: "disc", color, fontSize: size }}
    >
      {kept.map((b, i) => (
        <li key={i} style={{ marginBottom: "1.5pt", lineHeight: 1.35 }}>
          {capitalizeSentences(b)}
        </li>
      ))}
    </ul>
  );
}

/** The skills a template shows as a flat list — the group headings are dropped by these designs. */
export function flatSkills(data: ResumePayload): string[] {
  return data.skills
    .flatMap((g) => g.items)
    .map((i) => capitalizeFirst(i.trim()))
    .filter((i) => i.length > 0);
}

export function languageLines(data: ResumePayload): string[] {
  return data.languages
    .filter((l) => l.name.trim().length > 0)
    .map((l) =>
      l.level?.trim()
        ? `${capitalizeFirst(l.name.trim())} — ${capitalizeFirst(l.level.trim())}`
        : capitalizeFirst(l.name.trim()),
    );
}

/**
 * The unpaid-preview watermark, positioned over any template.
 *
 * Lifted out of `resume-sheet.tsx` so all four templates share one implementation — the rule it enforces
 * (nothing of value leaves the system unpaid, ADR-0012) must not depend on which design is selected.
 */
export function Watermark({ text }: { text: string }): ReactNode {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        justifyContent: "center",
        gap: "18mm",
        overflow: "hidden",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          style={{
            transform: "rotate(-30deg)",
            fontSize: "24pt",
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "rgba(17,17,17,0.10)",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Preview placeholders
 *
 * An empty CV rendered faithfully is a blank page, which tells a chooser nothing about a template. So
 * the editor preview fills unwritten slots with faint stand-ins — the field's name where a single value
 * goes, grey bars where prose or a list goes — and the layout keeps its real proportions.
 *
 * **They never reach the PDF.** `ResumeSheet` takes `placeholders` and the print route leaves it off, so
 * a downloaded CV cannot contain "Votre nom" or a grey bar. That is the whole reason this is a render
 * flag rather than default text written into the payload: default text would be saved, exported, and
 * eventually emailed to a recruiter.
 * ---------------------------------------------------------------------------------------------- */

/** Faint bars standing in for text not yet written. The last one is short, as a real paragraph is. */
export function GhostLines({
  count = 3,
  width = "100%",
  height = "2.4mm",
  gap = "1.7mm",
}: {
  count?: number;
  width?: string;
  height?: string;
  gap?: string;
}): ReactNode {
  return (
    <div aria-hidden style={{ display: "flex", flexDirection: "column", gap, width }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: i === count - 1 ? "62%" : "100%",
            height,
            borderRadius: "1mm",
            background: "#e6e6ea",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          }}
        />
      ))}
    </div>
  );
}

/**
 * The real value, or a faint label naming what belongs there.
 *
 * Renders `null` when the value is empty and placeholders are off, so the print output is unchanged.
 */
export function Ph({
  value,
  label,
  on,
  style,
}: {
  value: string;
  label: string;
  on: boolean;
  style?: CSSProperties;
}): ReactNode {
  const written = value.trim().length > 0;
  if (written) return <span style={style}>{value}</span>;
  if (!on) return null;

  return (
    <span style={{ ...style, opacity: 0.34 }} aria-hidden>
      {label}
    </span>
  );
}

/** Whether a section should appear at all: it has content, or the preview is showing its shape. */
export const showSection = (hasContent: boolean, placeholders: boolean): boolean =>
  hasContent || placeholders;

/**
 * The CV portrait, as the European designs show it.
 *
 * `objectFit: cover` on a fixed circle so any aspect ratio crops to the same shape — a portrait and a
 * landscape snapshot must not produce two differently-sized headers.
 *
 * A plain `<img>`, not `next/image`: the source is a Cloudinary URL on a host `next.config` does not
 * list, and the print engine needs a real `<img>` it can lay out synchronously anyway.
 *
 * Renders the dashed placeholder ring only in the preview (`placeholders`), never in the PDF — an empty
 * circle printed on a CV looks like a missing image, which is worse than no circle at all.
 */
export function Portrait({
  url,
  size = "26mm",
  placeholders = false,
}: {
  url: string | undefined;
  size?: string;
  placeholders?: boolean;
}): ReactNode {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          flexShrink: 0,
        }}
      />
    );
  }

  if (!placeholders) return null;

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "0.4mm dashed #d0d0d6",
        display: "block",
        flexShrink: 0,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    />
  );
}
