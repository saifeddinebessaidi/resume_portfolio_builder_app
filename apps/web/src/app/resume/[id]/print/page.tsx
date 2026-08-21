import { resumePayloadSchema } from "@repo/contracts";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PrintTrigger } from "@/features/resume/print-trigger";
import { hasCleanCopy } from "@/features/resume/clean-copy";
import { ResumeSheet } from "@/features/resume/resume-sheet";
import { isApiProblem } from "@/lib/api/problem";
import { projectsApi } from "@/lib/api/endpoints";

/**
 * The print route — what becomes the PDF.
 *
 * Deliberately **outside `(app)/`**: no navbar, no aurora background, no shell. The page is the sheet
 * and nothing else, so the browser's print engine paginates the resume rather than the dashboard
 * chrome around it.
 *
 * ## Why the browser prints this instead of Playwright
 *
 * The builder repository renders PDFs with Playwright + Chromium (~300MB) and solves the deployment
 * with a Dockerfile. This project has "no Docker" and "no paid services" as stated constraints
 * (docs/README.md), so that path is closed. Handing the job to the visitor's own browser satisfies both
 * — and produces a **better** artefact for the ATS layout's actual purpose: `window.print()` emits real,
 * selectable, parseable text. A canvas-based library (html2canvas + jsPDF) would emit a raster image
 * that no applicant-tracking system can read, which defeats the entire point of an ATS template.
 *
 * The cost is honest: the user passes through the browser's print dialog, and the server never holds a
 * file. Recorded as ADR-0011.
 */
export default async function ResumePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;

  let data;
  let clean: boolean;

  try {
    const project = await projectsApi.detail(id);
    // Parsed, not cast: an older stored `schemaVersion` may lack fields added since, and the schema's
    // defaults fill them rather than the template rendering `undefined` into the PDF.
    data = resumePayloadSchema.parse(project.data);

    /**
     * **The bypass guard.** This route is a normal URL, so someone can navigate to it directly and
     * print without ever pressing Télécharger. The same server-side rule the preview uses applies here:
     * no paid download on this project means the PDF comes out watermarked.
     *
     * A 403 would be the other option, but it breaks the legitimate case — re-printing something you
     * already bought — and a watermark degrades gracefully instead of blocking.
     */
    clean = hasCleanCopy(project);
  } catch (error) {
    if (isApiProblem(error) && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <ResumeSheet data={data} watermark={!clean} />
      <PrintTrigger />
    </>
  );
}
