import { cursorPayloadSchema, type CursorPayload } from "@repo/contracts";

/**
 * Keyset pagination on `(createdAt, id)`.
 *
 * The `id` tiebreaker is load-bearing: `createdAt` collides on bulk operations (a seed, a batch
 * insert in the same millisecond), and ordering on the timestamp alone makes a page boundary
 * unstable — a row can be dropped or duplicated across pages.
 *
 * Offset pagination is not offered at all: it double-counts and skips rows when items are
 * inserted concurrently, which for a project list open in two tabs is not hypothetical.
 *
 * Lives in the API rather than in contracts because base64 needs `Buffer` (Node) or `btoa`
 * (browser), and contracts ships to both. The client never decodes: it passes `nextCursor` back
 * verbatim, which is what "opaque" means.
 */
export const encodeCursor = (row: { id: string; createdAt: Date }): string =>
  Buffer.from(
    JSON.stringify({ id: row.id, createdAt: row.createdAt.toISOString() }),
    "utf8",
  ).toString("base64url");

/**
 * Returns `null` on anything malformed rather than throwing: a stale or hand-edited cursor
 * should degrade to "start from the beginning", not 500 the request.
 */
export function decodeCursor(cursor: string | undefined): CursorPayload | null {
  if (!cursor) return null;

  try {
    const json: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const parsed = cursorPayloadSchema.safeParse(json);
    if (!parsed.success) return null;

    // A cursor whose timestamp is not a real date would produce `Invalid Date` in the WHERE
    // clause and silently return nothing.
    const createdAt = new Date(parsed.data.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;

    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * The Prisma `where` fragment for "everything strictly after this cursor", newest first.
 *
 * Expressed as an OR rather than a compound comparison because Postgres row-value comparison is
 * not something Prisma's query builder exposes.
 */
export function cursorWhere(
  cursor: CursorPayload | null,
): { OR: [{ createdAt: { lt: Date } }, { createdAt: Date; id: { lt: string } }] } | undefined {
  if (!cursor) return undefined;

  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }],
  };
}

/**
 * Trims an over-fetched page to `limit` and derives the next cursor from the last row kept.
 *
 * Callers fetch `limit + 1` rows: the presence of the extra row is what proves another page
 * exists, without a second `count(*)` query.
 */
export function paginate<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}
