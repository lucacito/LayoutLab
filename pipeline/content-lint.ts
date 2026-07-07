// Deterministic content-quality gate for generated layouts.
//
// The deterministic validator (pipeline/validate.ts) proves a layout is STRUCTURALLY
// valid Divi 5 — it says nothing about whether the COPY is finished. Generated
// sections still occasionally ship placeholder tokens ("EYEBROW", "[Replace: …]"),
// lorem ipsum, Divi demo filler ("Your content goes here"), $XX price stubs,
// example.com / 555-01xx fictional contacts, or unresolved placeholder image hosts.
// None of those belong in a paid marketplace. This lint catches them so the pipeline
// can repair (feed the codes back to the model) or drop — the same flag-and-gate
// philosophy as validation, but for content instead of structure.
//
// Fails OPEN (returns []) on unparseable input so it can never crash a run; the
// structural validator is the hard gate for malformed JSON.

export interface LintViolation {
  code: string;
  message: string;
  /** A short excerpt of the offending text, for logs + model repair prompts. */
  sample: string;
}

interface Rule {
  code: string;
  /** Short, log-facing description shown next to a triggered violation (in the
   *  admin log and in the per-issue list the content-repair prompt restates). */
  message: string;
  /** Prompt-facing ban text — the SINGLE source the generation directives
   *  (`pipeline/recipes/prompts.ts` directives()) and the content-repair prompt's
   *  generic "Rules:" reminder both derive from (via `bannedContentProse()`), so a
   *  new ban can never update the enforced regex without also updating what we
   *  tell the model to avoid in the first place. */
  prose: string;
  re: RegExp;
}

// Order matters only for readability; every rule is evaluated independently.
const RULES: Rule[] = [
  {
    code: 'LOREM_IPSUM',
    message: 'Lorem ipsum filler text — write real, specific copy.',
    prose: 'No lorem ipsum — write real, specific copy for this niche.',
    re: /\b(lorem\s+ipsum|dolor\s+sit\s+amet|consectetur\s+adipiscing|sed\s+do\s+eiusmod)\b/i,
  },
  {
    code: 'DIVI_FILLER',
    message: 'Divi demo filler ("Your content goes here" / "Edit or remove this text").',
    prose: 'No Divi demo filler like "Your content goes here" or "Edit or remove this text".',
    re: /your\s+content\s+goes\s+here|edit\s+or\s+remove\s+this\s+text|click\s+edit\s+button\s+to\s+change/i,
  },
  {
    code: 'EYEBROW_TOKEN',
    message: 'Literal "Eyebrow" placeholder label left as content (write a real eyebrow label or drop it).',
    prose:
      'No literal placeholder word "EYEBROW" — if a section has a small eyebrow/label above the headline, ' +
      'write a REAL short label instead (e.g. "Established 2014" or "For SaaS teams").',
    // Two placeholder shapes: (a) all-caps EYEBROW not in a beauty context; (b) title-
    // case "Eyebrow" used as a label, i.e. immediately followed by a separator (— · | :).
    // Ordinary prose ("shapes every eyebrow in seconds") matches neither.
    re: /\bEYEBROW\b(?!\s+(gel|pencil|kit|serum|tint|shaping|threading|wax|artist|bar))|\bEyebrow\b\s*[—–\-·|:]/,
  },
  {
    code: 'BRACKET_TOKEN',
    message: 'Bracketed placeholder token (e.g. "[Replace: …]", "[insert …]", "[$XX]").',
    prose: 'No bracketed placeholder tokens like "[Replace: …]", "[insert …]", or "[$XX/month]".',
    re: /\[[^\]]*\b(replace|insert|your\s|placeholder|todo|company\s+name|client\s+name|name\s+here|xx+)\b[^\]]*\]/i,
  },
  {
    code: 'PRICE_PLACEHOLDER',
    message: 'Placeholder price ("$XX", "XX/month") — use a real number.',
    prose: 'No "$XX"/"XX per month" price stubs — always use a real number (e.g. "$29/mo").',
    re: /\$?\bX{2,}\b\s*(?:\/\s*(?:mo|month|yr|year|week))?|\bX{2,}\s*\/\s*(?:mo|month|yr|year|week)\b/,
  },
  {
    code: 'EXAMPLE_EMAIL',
    message: 'example.com/.org/.net contact address — use a plausible branded email.',
    prose: 'No example.com/.org/.net contact address — use a plausible email on the business\'s own domain.',
    re: /[a-z0-9._%+-]+@example\.(?:com|org|net)\b/i,
  },
  {
    code: 'FAKE_PHONE',
    message: 'Reserved fictional 555-01xx phone number — use a plausible number.',
    prose: 'No reserved fictional 555-01xx phone number — use a realistic phone number.',
    re: /\b555[\s.\-]?01\d{2}\b|\(?\d{3}\)?[\s.\-]?555[\s.\-]?01\d{2}\b/,
  },
  {
    code: 'PLACEHOLDER_IMAGE',
    message: 'Unresolved placeholder image host (loremflickr.com / placehold.co / via.placeholder).',
    prose:
      'No placehold.co / via.placeholder / placekitten / dummyimage URLs — every image must be a real photo ' +
      '(loremflickr/pravatar URLs are fine; they are resolved to real photos later).',
    re: /https?:\/\/(?:[a-z0-9-]+\.)*(?:loremflickr\.com|placehold\.co|placeholder\.com|placekitten\.com|dummyimage\.com)\b/i,
  },
  {
    code: 'EMPTY_IMAGE',
    message: 'Empty image src — every image must point at a real photo.',
    prose: 'No empty image src ("src":"") — every image must point at a real photo URL.',
    re: /"src"\s*:\s*""/,
  },
];

/** The single source of truth for the human-readable content bans: every entry
 *  here corresponds 1:1 to an enforced RULES regex above, so the generation
 *  directive and the content-repair prompt (both in `pipeline/recipes/prompts.ts`)
 *  can never drift from what the lint actually rejects — a new ban added to RULES
 *  automatically updates both prompt texts. */
export function bannedContentProse(): string[] {
  return RULES.map((r) => r.prose);
}

// Image rules only make sense AFTER image resolution (loremflickr → Pexels). Section-
// level linting (during full-landing compose) runs before that, so it skips these.
export const IMAGE_RULE_CODES = ['PLACEHOLDER_IMAGE', 'EMPTY_IMAGE'];

/** Lint a Divi post_content string; one violation per triggered rule (deduped), each with a sample. */
export function lintLayoutContent(postContent: string, opts: { skip?: string[] } = {}): LintViolation[] {
  const skip = new Set(opts.skip ?? []);
  const out: LintViolation[] = [];
  for (const rule of RULES) {
    if (skip.has(rule.code)) continue;
    const m = rule.re.exec(postContent);
    if (m) out.push({ code: rule.code, message: rule.message, sample: excerpt(postContent, m.index, m[0].length) });
  }
  return out;
}

function excerpt(s: string, index: number, len: number): string {
  const start = Math.max(0, index - 12);
  const end = Math.min(s.length, index + len + 12);
  return (start > 0 ? '…' : '') + s.slice(start, end).replace(/\s+/g, ' ').trim() + (end < s.length ? '…' : '');
}

/** Lint the post_content of a full layout document ({ post_content, … }). Fails open. */
export function lintLayoutJson(json: string, opts: { skip?: string[] } = {}): LintViolation[] {
  let obj: { post_content?: string };
  try {
    obj = JSON.parse(json);
  } catch {
    return [];
  }
  if (typeof obj.post_content !== 'string') return [];
  return lintLayoutContent(obj.post_content, opts);
}
