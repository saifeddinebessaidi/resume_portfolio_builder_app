import { z } from "zod";

/**
 * Cursor pagination, never offset.
 *
 * Offset pagination double-counts and skips rows when items are inserted concurrently. For a
 * project list that is actively being edited in another tab, that is not hypothetical.
 */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

export const pageRequestSchema = z.object({
  /** Opaque. Clients pass back exactly what `nextCursor` gave them and never construct one. */
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type PageRequest = z.infer<typeof pageRequestSchema>;

/**
 * A generic factory rather than a fixed schema, so `items` keeps its element type through
 * `z.infer` instead of degrading to `unknown[]`.
 */
export const pageResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    /** `null` means this is the last page. */
    nextCursor: z.string().nullable(),
  });

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * The cursor payload. Base64 of `{ id, createdAt }` — the id breaks ties when two rows share
 * a timestamp, which is common when a seed or a batch insert writes several rows in the same
 * millisecond. Sorting on a timestamp alone makes such a page boundary unstable.
 */
export const cursorPayloadSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
});

export type CursorPayload = z.infer<typeof cursorPayloadSchema>;

/**
 * The encode/decode pair deliberately lives in the API (`common/pagination/`), not here.
 *
 * Base64 needs `Buffer` (Node) or `btoa` (browser), and this package ships to both — pulling
 * either global's types in would make a browser bundle depend on Node types or a server
 * package depend on the DOM. The client never needs to decode a cursor: it receives
 * `nextCursor` and passes it back verbatim, which is what "opaque" means. Only the schema is
 * shared, so both sides agree on the payload shape.
 */
