/**
 * Capitalisation applied **when a page is rendered**, never to what is stored.
 *
 * Lives in `lib/` rather than under `features/resume/`, where it started: the public portfolio page has
 * exactly the same problem — someone types `célia ben salah` into a form and it must not appear that way
 * on a page they are sending to a casting director. One implementation, or the two screens disagree.
 *
 * ## Why render-time and not on input
 *
 * Rewriting a field as the user types fights them: the caret jumps, an undo no longer undoes what they
 * did, and correcting the first letter becomes impossible because every keystroke re-capitalises it.
 * Transforming at render means the payload stays exactly what was typed, the preview shows what will
 * print, and a user who genuinely wants a lowercase title can still get one by... well, see the guard
 * below.
 *
 * It also means the **PDF gets it for free** — the print route renders the same blocks.
 *
 * ## The guard that makes this safe
 *
 * Naively upper-casing character zero destroys real-world casing: `iOS` becomes `IOS`, `eBay` becomes
 * `EBay`, `npm` becomes `Npm`. So a word is only capitalised when it starts with a lowercase letter
 * **and its second character is not uppercase** — which is precisely the shape of a deliberately
 * lower-cased brand or acronym. Everything after the first character is left alone in every case, so
 * `SQL`, `PostgreSQL` and `React.js` survive untouched.
 */

/** Letters that count as lowercase starts, including the accented ones French needs. */
const LOWER_START = /^[a-zà-öø-ÿ]/;
/** A lowercase first letter immediately followed by a capital — `iOS`, `eBay`, `iPhone`. Leave alone. */
const CAMEL_BRAND = /^[a-zà-öø-ÿ][A-ZÀ-ÖØ-Þ]/;

const shouldCapitalize = (word: string): boolean =>
  LOWER_START.test(word) && !CAMEL_BRAND.test(word);

/** Upper-cases the first character only, when the guard allows it. */
export function capitalizeFirst(value: string | undefined): string {
  const s = value ?? "";
  if (!shouldCapitalize(s)) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A person's name.
 *
 * Word-by-word, but **only when the whole input has no capitals at all** — the signature of someone who
 * typed `amine ben salah` without bothering. Then every word is lifted and it reads correctly.
 *
 * The moment the user has capitalised anything themselves, their casing is respected in full and only
 * the very first character is considered. That is what protects `van der Berg` and `Ali ben Youssef`
 * from being "corrected" into something their owner did not choose — a name is the one field where
 * guessing is rudest.
 */
export function properName(value: string | undefined): string {
  const s = value ?? "";
  if (s.length === 0) return s;

  const hasNoCapitals = s === s.toLowerCase();
  if (!hasNoCapitals) return capitalizeFirst(s);

  return s.replace(
    /(^|[\s'’-])([a-zà-öø-ÿ])/g,
    (_m, sep: string, ch: string) => sep + ch.toUpperCase(),
  );
}

/**
 * Prose: the first letter of the string and of every following sentence.
 *
 * Sentence boundaries are `.`, `!`, `?` followed by whitespace, plus every new line — a bullet list
 * written one item per line gets each line capitalised, which is what a reader expects.
 *
 * The same brand guard applies at each boundary, so a bullet starting `iOS builds…` is not mangled.
 */
export function capitalizeSentences(value: string | undefined): string {
  const s = value ?? "";
  if (s.length === 0) return s;

  return s.replace(
    // Start of string, or after a sentence terminator / newline, then the first word.
    /(^|[.!?]\s+|\n\s*)([^\s]+)/g,
    (_m, lead: string, word: string) => lead + capitalizeFirst(word),
  );
}
