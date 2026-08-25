/**
 * Normalisers for what a model actually returns, as opposed to what it was asked for.
 *
 * Lifted out of `generate-portfolio-content.use-case.ts` when a second use case needed the same
 * treatment. The reasoning is unchanged and worth keeping in one place: a model asked for a string will
 * occasionally return an array of paragraphs, and one asked for an array will sometimes return a
 * comma-joined string. Both are trivially recoverable, and failing an entire generation over a shape a
 * normaliser can fix is a worse product for no gain in safety — the *set of fields* is still limited by
 * the response schema, which is the part that actually matters.
 */

/** A string, or paragraphs the model returned as an array. Anything else becomes empty. */
export function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string")
      .join("\n\n")
      .trim();
  }
  return "";
}

/** An array of strings, or a comma-separated string the model returned instead. */
export function asList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : typeof value === "string"
      ? value.split(",")
      : [];

  return items.map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 120);
}
