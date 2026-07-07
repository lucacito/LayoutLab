// Generate ONE full-landing page in the "Bold Steakhouse" identity (the dark,
// wood-fired, chef's-counter look of the bold-steakhouse hero the user liked).
// Reuses the theme pipeline (composeLanding + validate → images → stack → dedupe →
// SEO → upload → render → ingest) for a single page — no pack assembly.
//
// Run: bash scripts/gen-steakhouse-landing.sh   (sources env, runs this)
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { claudeCliClient } from '@/pipeline/llm';
import { loadGrounding } from '@/pipeline/recipes';
import { validateLayout } from '@/pipeline/validate';
import { uploadLayout, uploadScreenshot } from '@/pipeline/upload';
import { realRenderDeps, renderLayout } from '@/pipeline/render';
import { resolveLayoutImages, pexelsSearcher } from '@/pipeline/images';
import { postIngest } from '@/pipeline/ingest';
import { runThemePack, type ThemeSpec, type ThemeDeps, type ThemePage } from '@/pipeline/theme';
import type { Brief, Step } from '@/pipeline/compose';

const BRIEF: Brief = {
  businessType: 'local business',
  businessName: 'Ember & Steel',
  tagline: 'A chef’s-counter steakhouse — dry-aged, wood-fired',
  audience: 'people who take a steak dinner seriously and want a front-row counter seat to the fire',
  conversionGoal: 'book a counter seat',
  primaryCta: 'Reserve a Counter Seat',
  accentColorHex: '#C2410C', // ember, used sparingly on near-black
  voice:
    'spare, confident, a little swaggering — short declarative sentences, no fluff. Fire. Steel. Flavor. ' +
    'Let the cooking talk. Cinematic and dark, never cheesy.',
};

const BRAND_FACTS =
  'Canonical brand facts — use these EXACT details anywhere contact info, hours, address, phone, email or ' +
  'booking appears, and NEVER invent alternatives or a second phone number: ' +
  'Name: Ember & Steel. A chef’s-counter steakhouse: every cut dry-aged in-house for 45 days and seared at ' +
  '1,200°F over hardwood embers; six courses, one counter, no printed menu — just whatever walked in that ' +
  'morning. Phone: (415) 555-0187. Email: hello@emberandsteel.com. Address: 88 Pier Street, San Francisco, CA 94111. ' +
  'Hours: Tue–Sat 5:30–11:00pm; closed Sunday and Monday. ' +
  'Aesthetic: DARK and monochrome — near-black backgrounds (#0a0a0a), off-white type, white or thin-outlined ' +
  'buttons, with a single warm ember accent (#C2410C) used sparingly. Bold, cinematic, high-contrast.';

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

const PAGE: ThemePage = {
  role: 'landing', roleLabel: 'Landing',
  flow: [
    S('hero', 'hero', 'Open in the register of the existing bold-steakhouse hero: the chef’s-counter promise — dry-aged 45 days, seared at 1,200°F over hardwood embers, six courses at one counter, no printed menu. A short, punchy "Fire. Steel. Flavor."-style headline. Dark, cinematic, ONE action — Reserve a Counter Seat — over a fire/steak image.', true),
    S('why', 'cards', 'Why Ember & Steel is different: 3–4 outcome-led cards — 45-day in-house dry-age, 1,200°F hardwood-ember sear, a six-course chef’s counter, no printed menu (whatever walked in that morning). Craft and outcomes, not features.', true),
    S('experience', 'features', 'The counter night: what it feels like to sit at the fire while the chef cooks in front of you — the pace, the smoke, the quiet swagger. Sell the evening, not a feature list.'),
    S('cuts', 'cards', 'The plates: signature cuts / the six courses as cards — each with the cut or dish name, a mouth-watering one-line description, and a bracketed price placeholder. Bold, hungry copy.', true),
    S('gallery', 'gallery', 'The fire, the cuts, and the room — cinematic, dark, high-contrast steakhouse photography.'),
    S('social_proof', 'testimonials', '2–3 short guest quotes about the counter and the food (bracketed placeholders, never fabricated as real).', true),
    S('final_cta', 'cta', 'Restate the promise and the one action: Reserve a Counter Seat tonight. Minimal, bold, dark.', true),
  ],
};

const SPEC: ThemeSpec = { niche: 'steakhouse', style: 'bold', color: 'dark', brief: BRIEF, brandFacts: BRAND_FACTS, pages: [PAGE] };

async function withTempFile<T>(json: string, fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'steak-'));
  const file = join(dir, 'layout.json');
  await writeFile(file, json);
  try { return await fn(file); } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

async function main() {
  const validatorDir = process.env.VALIDATOR_DIR ?? '../Divi 5 Deterministic Validator';
  const guide = loadGrounding(validatorDir);
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const pexelsKey = process.env.PEXELS_API_KEY;
  const ingestUrl = process.env.INGEST_URL ?? 'http://localhost:3000';
  const ingestToken = process.env.INGEST_API_TOKEN ?? '';
  const maxBudget = process.env.PIPELINE_MAX_BUDGET_USD ? Number(process.env.PIPELINE_MAX_BUDGET_USD) : 4;
  const renderer = await realRenderDeps();

  const deps: ThemeDeps = {
    llm: claudeCliClient({ model: process.env.PIPELINE_MODEL }),
    guide,
    pageExists: async (slug) => {
      const hit = await db.select({ id: layouts.id }).from(layouts).where(eq(layouts.slug, slug)).limit(1);
      return hit.length > 0;
    },
    validate: (json) => withTempFile(json, (f) => validateLayout(f)),
    resolveImages: pexelsKey ? (json) => resolveLayoutImages(json, pexelsSearcher(pexelsKey)) : undefined,
    isDuplicate: async (hash) => {
      const hit = await db.select({ id: layouts.id }).from(layouts).where(eq(layouts.contentHash, hash)).limit(1);
      return hit.length > 0;
    },
    upload: (hash, json) => uploadLayout(hash, json, { hasBlobToken, outDir: 'pipeline/out' }),
    render: async ({ title, postContent, hash }) => {
      try {
        const { shots, perceptualHash } = await renderLayout({ title, postContent }, renderer.deps);
        const keys: string[] = [];
        for (const label of ['desktop', 'mobile'] as const) {
          const shot = shots.find((s) => s.label === label);
          if (shot) keys.push(await uploadScreenshot(hash, label, shot.buffer, { hasBlobToken }));
        }
        return { previewImageKeys: keys, perceptualHash };
      } catch (e) {
        console.warn(`[steak] render failed: ${(e as Error).message}`);
        return { previewImageKeys: [] };
      }
    },
    ingest: (payload) => postIngest(payload, { url: ingestUrl, token: ingestToken }),
    maxRepairs: 3,
    maxParseRetries: 2,
    maxBudgetUsd: maxBudget,
    log: (m) => console.log(`[steak] ${m}`),
  };

  console.log(`[steak] generating the Ember & Steel bold steakhouse landing page…`);
  const result = await runThemePack(SPEC, deps);
  await renderer.close();
  console.log('[steak] summary:', { generated: result.generated, ingested: result.ingested, dropped: result.dropped, deduped: result.deduped, slugs: result.pageSlugs });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
