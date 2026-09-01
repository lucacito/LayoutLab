// Rewrites em dashes out of stored copy. The catalog's titles and prose were
// AI-generated before the house style banned em dashes (tests/no-em-dashes.test.ts
// covers the in-repo side); this is the same rule applied to the DB rows that
// scripts/backfill-em-dashes.ts sweeps.
//
// The character is written as a \u2014 escape throughout so that this file, which
// necessarily talks about em dashes, still passes the guard test itself.
//
// Substituting one character everywhere would produce bad prose, so the choice
// is made per occurrence from the shape of the sentence around it.

const EM_DASH = '\u2014';

/** A spaced or unspaced em dash, plus whatever whitespace it is padded with. */
const DASH = /\s*\u2014\s*/g;

/**
 * Sentence boundaries and paragraph breaks, captured rather than consumed.
 * Splitting on a capturing group keeps the separators in the array, so the
 * original whitespace (including the blank lines that separate markdown
 * paragraphs in taxonomy_pages.body) survives the round trip untouched.
 */
const BOUNDARY = /((?<=[.!?])\s+|\n+)/;

/**
 * Words that reliably open a fresh noun phrase after a parenthesised aside, and
 * therefore need a comma to avoid a run-on ("…(a, b, c), each one validated").
 * Everything else is far more often a verb continuing the main clause
 * ("…make small details (a, b) do the heavy lifting"), which takes no comma.
 * A handful of participial tails ("…paired with", "…supported by") read a
 * little bare under this rule; that is the deliberate trade for not guessing
 * wrong in the commoner direction.
 */
const NEW_CLAUSE_OPENERS = new Set(['each', 'not', 'a', 'an', 'one', 'this', 'these', 'it', 'they']);

/**
 * Openers that can only begin an independent clause, so the aside deserves its
 * own sentence rather than a comma splice. Deliberately limited to pronoun+verb
 * forms: a bare pronoun is ambiguous, since "for teams ... you and your clients"
 * is a noun phrase rather than a clause, and would be split wrongly.
 */
const CLAUSE_OPENERS = [
  /^it\s+is\b/i, /^it[\u2019']s\b/i, /^they\s+are\b/i, /^they[\u2019']re\b/i,
  /^that[\u2019']s\b/i, /^there[\u2019']s\b/i, /^you[\u2019']ll\b/i, /^you[\u2019']re\b/i,
  /^we[\u2019']ll\b/i, /^we[\u2019']ve\b/i,
];

function replaceTitle(text: string): string {
  // A title's dash is a separator, so a colon reads best. Fall back rather than
  // stack a second colon (or a second pipe) into one line.
  const separator = !text.includes(':') ? ': ' : !text.includes('|') ? ' | ' : ', ';
  return text.replace(DASH, separator);
}

function replaceSentence(sentence: string): string {
  const count = (sentence.match(/\u2014/g) ?? []).length;
  if (count === 0) return sentence;

  // A matched pair brackets an aside, which is exactly what parentheses are for.
  if (count === 2) {
    const [head, aside, tail] = sentence.split(DASH);
    if (head && aside && tail !== undefined) {
      const opener = tail.trimStart().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
      const join = NEW_CLAUSE_OPENERS.has(opener) ? ', ' : ' ';
      return `${head} (${aside})${join}${tail}`
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ');
    }
  }

  // The first character after the dash is consumed along with it, so that an
  // aside promoted to its own sentence can be capitalised right here rather than
  // by a later pass that could not tell which periods this function inserted.
  return sentence.replace(/\s*\u2014\s*(.)/, (_match, next: string, offset: number) => {
    const head = sentence.slice(0, offset);
    const rest = sentence.slice(offset).replace(/^\s*\u2014\s*/, '');

    if (CLAUSE_OPENERS.some((re) => re.test(rest))) return `. ${next.toUpperCase()}`;

    // An aside that is itself a comma list is explanatory, so a colon keeps that
    // reading (unless the sentence already spends its one colon elsewhere).
    if (rest.includes(',')) return `${head.includes(':') ? ', ' : ': '}${next}`;

    // Otherwise a comma normally reads best, except after a head that is already
    // a comma list: one more comma would file the trailing qualifier as another
    // list item, where a full stop reads it correctly as a coda.
    if (head.includes(',')) return `. ${next.toUpperCase()}`;

    return `, ${next}`;
  });
}

export function deEmDash(text: string, opts: { title?: boolean } = {}): string {
  if (!text.includes(EM_DASH)) return text;
  if (opts.title) return replaceTitle(text);

  // Odd indices are the captured separators; leave them exactly as they were.
  return text
    .split(BOUNDARY)
    .map((part, i) => (i % 2 === 0 ? replaceSentence(part) : part))
    .join('');
}

/** Keys whose values read as titles rather than prose. */
const TITLE_KEYS = new Set(['title', 'metaTitle', 'meta_title', 'heading', 'h1', 'ogTitle']);

/** Applies {@link deEmDash} to every string inside a JSON value, and nothing else. */
export function deEmDashJson<T>(value: T, key?: string): T {
  if (typeof value === 'string') {
    return deEmDash(value, { title: key !== undefined && TITLE_KEYS.has(key) }) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deEmDashJson(v, key)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deEmDashJson(v, k)]),
    ) as T;
  }
  return value;
}
