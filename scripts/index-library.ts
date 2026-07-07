// Index the converted D5 corpus (pipeline/library/d5/*.json) into SECTION-level
// exemplars: parse source filename → {pageType, industry}, slice into sections,
// classify each section's kind by its module palette. Writes pipeline/library/
// index.json (metadata + markup) for the retrieval step. No LLM.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'pipeline/library/d5';
const OUT = 'pipeline/library/index.json';

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

function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const exemplars: Array<{
    slug: string; source: string; pageType: string; industry: string;
    sectionIndex: number; kind: string; palette: Record<string, number>; chars: number; markup: string;
  }> = [];
  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const { source, post_content } = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as { source: string; post_content: string };
    const { pageType, industry } = parseSource(source);
    const secs = sliceSections(post_content);
    secs.forEach((markup, i) => {
      const pal = palette(markup);
      exemplars.push({ slug, source, pageType, industry, sectionIndex: i, kind: classify(pal, markup, i, secs.length), palette: pal, chars: markup.length, markup });
    });
  }
  writeFileSync(OUT, JSON.stringify({ generatedFrom: DIR, pages: files.length, exemplars }, null, 2));

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
