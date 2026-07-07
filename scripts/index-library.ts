// Index the converted D5 corpus (pipeline/library/d5/*.json) into SECTION-level
// exemplars: parse source filename → {pageType, industry}, slice into sections,
// classify each section's kind by its module palette, build a lexical `descriptor`
// per section, and BM25-index those descriptors. Writes pipeline/library/index.json
// (metadata + markup, for the few-shot text) and pipeline/library/index-bm25.json
// (T3.4 — precomputed BM25 corpus statistics for semantic-ish retrieval; see
// pipeline/library/exemplars.ts and pipeline/library/bm25.ts). No LLM, no network —
// both outputs regenerate deterministically from pipeline/library/d5/*.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBm25Index } from '@/pipeline/library/bm25';

const DIR = 'pipeline/library/d5';
const OUT = 'pipeline/library/index.json';
const BM25_OUT = 'pipeline/library/index-bm25.json';

function parseSource(src: string): { pageType: string; industry: string } {
  const parts = src.split(/\s*-\s*/).map((s) => s.trim());
  const pageTypeRaw = (parts[0] ?? '').toLowerCase();
  const pageType = (pageTypeRaw.replace(/\b(us|page)\b/g, '').trim().split(/\s+/)[0] || 'unknown');
  const industry =
    (parts[1] ?? '')
      .replace(/\bLayouts?\b/gi, '')
      .replace(/\bPacks?\b/gi, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown';
  return { pageType, industry };
}

function sliceSections(content: string): string[] {
  return content.match(/<!-- wp:divi\/section[\s\S]*?<!-- \/wp:divi\/section -->/g) ?? [];
}

function palette(section: string): Record<string, number> {
  const p: Record<string, number> = {};
  for (const m of section.matchAll(/<!-- wp:divi\/([a-z0-9-]+)/g)) {
    const t = m[1];
    if (t === 'section' || t === 'row' || t === 'column' || t === 'placeholder') continue;
    p[t] = (p[t] ?? 0) + 1;
  }
  return p;
}

function classify(pal: Record<string, number>, section: string, index: number, total: number): string {
  const has = (k: string) => (pal[k] ?? 0) > 0;
  const cnt = (k: string) => pal[k] ?? 0;
  const cols = (section.match(/<!-- wp:divi\/column/g) ?? []).length;
  const rows = (section.match(/<!-- wp:divi\/row/g) ?? []).length;
  const sectionHasBgImage = /"background":\{[^}]*"image"/.test(section) || /"image":\{[^}]*"url"/.test(section.slice(0, 1200));
  const distinctModules = Object.keys(pal).length;
  // Strong-signal modules first.
  if (has('testimonial')) return 'testimonials';
  if (has('toggle') || has('accordion')) return 'faq';
  if (has('contact-form') || has('contact_form') || has('form') || has('map')) return 'contact';
  if (has('pricing-table') || has('pricing-tables') || has('pricing') || has('shop')) return 'pricing';
  if (has('number-counter') || has('counter') || has('circle-counter') || has('bar-counters')) return 'stats';
  if (has('gallery') || cnt('image') >= 4) return 'gallery';
  if (has('slider') || has('post-slider') || has('fullwidth-slider')) return 'slider';
  if (has('blog') || has('post-content') || has('posts') || has('portfolio')) return 'blog';
  if (has('video') || has('code')) return 'media';
  // Position: the FIRST section of a page is almost always the hero/header.
  if (index === 0 && (has('heading') || has('text'))) return 'hero';
  // Multi-column feature/benefit grids.
  if (cnt('blurb') >= 2) return 'features';
  if (cols >= 3 && (has('blurb') || has('image') || has('text'))) return 'features';
  // Last section with a button ≈ closing CTA.
  if (index === total - 1 && has('button') && (has('text') || has('heading'))) return 'cta';
  // Compact heading+button block anywhere ≈ CTA band.
  if (has('button') && distinctModules <= 3 && (has('text') || has('heading'))) return 'cta';
  // Single-column narrative (image + copy) block.
  if (cols <= 2 && has('image') && (has('text') || has('heading'))) return 'feature_detail';
  if (cnt('blurb') >= 1) return 'features';
  if (has('button')) return 'cta';
  if (has('heading') || has('text')) return 'content';
  void sectionHasBgImage; void rows;
  return 'other';
}

// Pull human-readable text out of a section's block markup. Divi/Gutenberg block
// attributes JSON-encode inner HTML as a `"value":"<h1>...</h1>"`-shaped string
// (often itself embedded inside an already-parsed JSON string, so escapes like
// < show up as literal characters in `markup`) — re-wrap each candidate value
// in quotes and JSON.parse it to decode escapes, then strip tags. This is a cheap
// heuristic (no HTML parser) but is enough to surface real headings/body copy
// (e.g. "Dental Checkup Today") into the BM25 descriptor, well beyond the bare
// industry slug / module-name vocabulary.
function extractText(markup: string): string {
  const out: string[] = [];
  const re = /"value":"((?:\\.|[^"\\])*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    const raw = m[1];
    if (!raw.includes('\\u003c') && !raw.includes('<')) continue; // only HTML-bearing values
    let decoded: string;
    try {
      decoded = JSON.parse(`"${raw}"`);
    } catch {
      continue;
    }
    const text = decoded
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) out.push(text);
  }
  // Sections often repeat the same card/column text 2-4x (one per column) —
  // de-dupe so the descriptor isn't dominated by a single repeated phrase.
  return [...new Set(out)].join(' ').slice(0, 500);
}

// Descriptor text indexed by BM25 (T3.4). Field set, in order of decreasing
// specificity: pageType, industry (hyphens split to words), kind, the module
// palette (each module name repeated by its count, so a section with 4 `blurb`
// modules weighs "blurb" 4x — TF signal for "how much of this kind of content"),
// and up to 500 chars of real extracted heading/body text. All lexical, no
// network — see pipeline/library/bm25.ts for why (T3.4 controller decision: BM25
// over embeddings, to stay dependency/network-free).
function buildDescriptor(pageType: string, industry: string, kind: string, pal: Record<string, number>, text: string): string {
  const paletteWords = Object.entries(pal)
    .flatMap(([mod, count]) => Array(count).fill(mod.replace(/-/g, ' ')))
    .join(' ');
  return [pageType, industry.replace(/-/g, ' '), kind, paletteWords, text].filter(Boolean).join(' ');
}

function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const exemplars: Array<{
    slug: string; source: string; pageType: string; industry: string;
    sectionIndex: number; kind: string; palette: Record<string, number>; chars: number;
    key: string; descriptor: string; markup: string;
  }> = [];
  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const { source, post_content } = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as { source: string; post_content: string };
    const { pageType, industry } = parseSource(source);
    const secs = sliceSections(post_content);
    secs.forEach((markup, i) => {
      const pal = palette(markup);
      const kind = classify(pal, markup, i, secs.length);
      const text = extractText(markup);
      const descriptor = buildDescriptor(pageType, industry, kind, pal, text);
      exemplars.push({
        slug, source, pageType, industry, sectionIndex: i, kind, palette: pal, chars: markup.length,
        key: `${slug}#${i}`, descriptor, markup,
      });
    });
  }
  writeFileSync(OUT, JSON.stringify({ generatedFrom: DIR, pages: files.length, exemplars }, null, 2));

  // T3.4 — BM25 index over the descriptors, precomputed offline and stored
  // alongside index.json. Same-shape docs regenerate byte-for-byte from the same
  // corpus, so this stays deterministic/repeatable (`bash scripts/index-library.sh`
  // regenerates both files together — they can never drift out of sync).
  const bm25 = buildBm25Index(exemplars.map((e) => ({ key: e.key, text: e.descriptor })));
  writeFileSync(BM25_OUT, JSON.stringify({ generatedFrom: OUT, ...bm25 }, null, 2));
  console.log(`BM25-indexed ${exemplars.length} descriptors → ${BM25_OUT} (vocab ${Object.keys(bm25.df).length} terms, avgDocLen ${bm25.avgDocLen.toFixed(1)})`);

  // Report distributions.
  const byKind: Record<string, number> = {};
  const byPage: Record<string, number> = {};
  const byIndustry = new Set<string>();
  for (const e of exemplars) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    byPage[e.pageType] = (byPage[e.pageType] ?? 0) + 1;
    byIndustry.add(e.industry);
  }
  console.log(`indexed ${exemplars.length} sections from ${files.length} pages → ${OUT}`);
  console.log('by kind:', Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join('  '));
  console.log('by pageType:', Object.entries(byPage).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join('  '));
  console.log(`industries (${byIndustry.size}):`, [...byIndustry].sort().join(', '));
  const median = exemplars.map((e) => e.chars).sort((a, b) => a - b)[Math.floor(exemplars.length / 2)];
  console.log(`section size: median ${median} chars, max ${Math.max(...exemplars.map((e) => e.chars))}`);
  // Diagnostics: overall module vocabulary + what the "other" sections look like.
  const mod: Record<string, number> = {};
  for (const e of exemplars) for (const [k, n] of Object.entries(e.palette)) mod[k] = (mod[k] ?? 0) + n;
  console.log('module vocab:', Object.entries(mod).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join('  '));
  const otherPals = exemplars.filter((e) => e.kind === 'other').map((e) => Object.keys(e.palette).sort().join('+') || '(empty)');
  const otherFreq: Record<string, number> = {};
  for (const p of otherPals) otherFreq[p] = (otherFreq[p] ?? 0) + 1;
  console.log('"other" palettes:', Object.entries(otherFreq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `[${k}]:${n}`).join('  '));
}
main();
