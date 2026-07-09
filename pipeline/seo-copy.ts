// pipeline/seo-copy.ts
// Generates SEO landing-page copy for every taxonomy axis value via the Claude CLI.
// Idempotent: values that already have stored copy are skipped.
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { extractJson } from './llm';
import type { LlmClient } from './llm';
import { getTaxonomyCopy, upsertTaxonomyCopy, type TaxonomyAxis, type TaxonomyCopy } from '@/lib/seo/taxonomy';

const AXES: TaxonomyAxis[] = ['type', 'niche', 'style', 'color'];

const SYSTEM =
  'You write SEO landing-page copy for a Divi 5 layout marketplace. Respond with ONLY a JSON object: ' +
  '{ "intro": string (2-3 sentences), "body": string (300-500 words of markdown), ' +
  '"metaTitle": string (<=60 chars), "metaDescription": string (<=155 chars) }. ' +
  'The body renders below the layout grid: explain what makes a good layout of this category, who uses it, ' +
  'and how to customize one in Divi 5 (presets, palette, copy). Write like a designer, never a keyword stuffer. ' +
  'Facts you may rely on: every layout is validated against Divi 5 structure before publication, sections are ' +
  'free downloads (email-gated) with a commercial license, screenshots show real desktop+mobile renders.';

function parseCopy(text: string): TaxonomyCopy {
  const obj = extractJson(text) as Record<string, unknown>;
  const intro = String(obj.intro ?? '').trim();
  const body = String(obj.body ?? '').trim();
  const metaTitle = String(obj.metaTitle ?? '').trim();
  const metaDescription = String(obj.metaDescription ?? '').trim();
  if (!intro || !body || !metaTitle || !metaDescription) throw new Error('incomplete copy');
  return { intro, body, metaTitle: metaTitle.slice(0, 70), metaDescription: metaDescription.slice(0, 160) };
}

export async function generateTaxonomyCopy(deps: {
  llm: LlmClient;
  getCopy?: typeof getTaxonomyCopy;
  upsert?: typeof upsertTaxonomyCopy;
  maxBudgetUsd?: number;
  log?: (m: string) => void;
}): Promise<{ generated: number; skipped: number; failed: number }> {
  const getCopy = deps.getCopy ?? getTaxonomyCopy;
  const upsert = deps.upsert ?? upsertTaxonomyCopy;
  const log = deps.log ?? (() => {});
  let generated = 0,
    skipped = 0,
    failed = 0;

  for (const axis of AXES) {
    for (const value of AXIS_VALUES[axis]) {
      // Skip only when the row is COMPLETE (has the long-form body). Rows
      // written before the body column existed regenerate — that's the
      // taxonomy-body backfill path.
      const existing = await getCopy(axis, value);
      if (existing?.body) {
        skipped++;
        continue;
      }
      try {
        const prompt = `Write SEO landing-page copy for the "${value}" ${axis} category of Divi 5 layouts.`;
        const out = await deps.llm.complete({ prompt, system: SYSTEM, maxBudgetUsd: deps.maxBudgetUsd });
        await upsert(axis, value, parseCopy(out));
        generated++;
        log(`generated ${axis}/${value}`);
      } catch (err) {
        failed++;
        log(`FAILED ${axis}/${value}: ${(err as Error).message}`);
      }
    }
  }
  return { generated, skipped, failed };
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('seo-copy.ts')) {
  (async () => {
    const { claudeCliClient } = await import('./llm');
    const r = await generateTaxonomyCopy({ llm: claudeCliClient(), maxBudgetUsd: 0.05, log: (m) => console.log(m) });
    console.log(`seo:copy done — generated ${r.generated}, skipped ${r.skipped}, failed ${r.failed}`);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
