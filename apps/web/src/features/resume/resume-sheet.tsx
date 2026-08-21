import { type ResumePayload } from "@repo/contracts";
import type { ReactNode } from "react";

import { SHEET, Watermark } from "./template-parts";
import { buildAtsBlocks } from "./ats-template";
import { TemplateAurora } from "./template-aurora";
import { TemplateBlush } from "./template-blush";
import { TemplateNavy } from "./template-navy";
import { TemplateTerracotta } from "./template-terracotta";
import { TemplateClassic } from "./template-classic";
import { TemplateTimeline } from "./template-timeline";
import { messages } from "@/messages/fr";

/**
 * An A4 sheet, at real dimensions.
 *
 * 210 × 297mm with 14mm padding, matching the builder's own sheet so what is previewed is what prints.
 * The PDF renderer in step 05 prints this same component with zero page margin — the padding lives here
 * rather than in the print settings, which is what keeps preview and output identical.
 *
 * Deliberately **not** paginated yet: the builder's client-side paginator measures rendered block
 * heights to decide page breaks, and that only matters for multi-page PDF output. A single flowing
 * sheet is honest for an editor preview, and step 05 brings the measuring paginator in with the
 * renderer that needs it.
 */
/**
 * Renders a résumé in whichever template its payload names.
 *
 * One component for preview **and** print: the editor scales this down on the right-hand side, and
 * `/resume/[id]/print` renders it at full size for `window.print()`. That is what makes "what you see is
 * what you download" true by construction rather than by two implementations agreeing.
 *
 * `ats` keeps the block-list renderer, because a paginator that measures individual bullets needs a flat
 * list. The designed templates are component trees and rely on the print engine's own `break-inside`
 * handling — see the note in `template-parts.tsx`.
 */
export function ResumeSheet({
  data,
  watermark = false,
  placeholders = false,
}: {
  data: ResumePayload;
  watermark?: boolean;
  /**
   * Fill unwritten slots with faint stand-ins so an empty CV still shows its layout.
   *
   * **Defaults to `false`, and the print route never turns it on.** A downloaded PDF containing "Votre
   * nom" or a grey bar would be worse than a blank one, so the default has to be the safe direction — a
   * new caller that forgets the flag gets the real document, not the mock-up.
   */
  placeholders?: boolean;
}): ReactNode {
  const sheet = (): ReactNode => {
    switch (data.template) {
      case "classic":
        return <TemplateClassic data={data} placeholders={placeholders} />;
      case "timeline":
        return <TemplateTimeline data={data} placeholders={placeholders} />;
      case "blush":
        return <TemplateBlush data={data} placeholders={placeholders} />;
      case "aurora":
        return <TemplateAurora data={data} placeholders={placeholders} />;
      case "navy":
        return <TemplateNavy data={data} placeholders={placeholders} />;
      case "terracotta":
        return <TemplateTerracotta data={data} placeholders={placeholders} />;
      case "ats":
        return <AtsSheet data={data} placeholders={placeholders} />;
    }
  };

  return (
    // The positioning context the watermark anchors to. Every template sets its own `position:
    // relative`, but the wrapper owns the overlay so the rule is enforced once for all four.
    <div style={{ position: "relative", width: "210mm" }}>
      {sheet()}
      {watermark ? <Watermark text={messages.resume.watermark} /> : null}
    </div>
  );
}

/**
 * The original plain layout, unchanged: Arial on white, single column, standard headings.
 *
 * Kept as the **default** template. It is the only one a naive applicant-tracking system parses
 * correctly, and quietly defaulting new CVs to a two-column design would make them less machine-readable
 * for the sake of looking better in a screenshot.
 */
function AtsSheet({
  data,
  placeholders,
}: {
  data: ResumePayload;
  placeholders: boolean;
}): ReactNode {
  return (
    <div
      // `.ats-root` supplies Arial and black-on-white, per the builder's convention — an ATS parser
      // reads a standard font on white, not our brand palette.
      className="ats-root"
      style={{
        ...SHEET,
        padding: "14mm",
        color: "#111",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {buildAtsBlocks(data, { placeholders }).map((b) => (
        <div key={b.id}>{b.node}</div>
      ))}
    </div>
  );
}
