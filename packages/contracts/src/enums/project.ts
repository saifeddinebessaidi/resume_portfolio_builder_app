import { z } from "zod";

export const ProjectStatus = {
  /** Created, editable. Version 1 exists and consumed no revision. */
  DRAFT: "DRAFT",
  /** The user marked it complete. Exportable and publishable. */
  READY: "READY",
  /** A live public link exists. PORTFOLIO / PORTFOLIO_PRO only. */
  PUBLISHED: "PUBLISHED",
  /** Soft-deleted. Still counted against the quota it consumed — deleting refunds nothing. */
  ARCHIVED: "ARCHIVED",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const projectStatusSchema = z.enum(ProjectStatus);

export const ExportFormat = {
  PDF: "PDF",
  PNG: "PNG",
  JSON: "JSON",
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const exportFormatSchema = z.enum(ExportFormat);
