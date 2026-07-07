// Phase 3b local-serving demo: render a curated set of real Divi 5 fixtures in the
// local WP env, save the desktop screenshot to public/screenshots/<slug>.png, the
// downloadable Divi markup to pipeline/out/layouts-json/<slug>.json (gated, not
// public), and upsert a published catalog layout row pointing at both — so /browse
// shows REAL screenshots. Run with the env sourced + the Docker WP env up:
//   set -a; . ./.env.local; set +a; npm run render:demo
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { realRenderDeps, renderLayout } from '@/pipeline/render';

const FIXDIR = process.env.RENDER_FIXTURES_DIR ?? '../Divi 5 Deterministic Validator/fixtures/valid';

// Curated from the validator's real Divi 5 premade-layout fixtures. Titles and
// taxonomy were verified against the actual rendered screenshots.
const DEMO = [
  { slug: 'fashion-stylist-landing', file: 'page-43-layout-1.json', title: 'Fashion Stylist Studio', type: 'full_landing', niche: 'agency', style: 'elegant', colors: ['orange', 'pastel'], description: 'An elegant landing page for a fashion stylist — services grid, about, and gallery.' },
  { slug: 'ar-experiences-landing', file: 'page-44-layout-2.json', title: 'Augmented Reality SaaS', type: 'full_landing', niche: 'saas', style: 'dark', colors: ['green', 'monochrome'], description: 'A bold, dark landing page for an augmented-reality / AR-VR software product.' },
  { slug: 'ramen-restaurant-landing', file: 'page-45-layout-3.json', title: 'Ramen Restaurant', type: 'full_landing', niche: 'restaurant', style: 'bold', colors: ['orange'], description: 'A warm, appetizing landing page for a ramen restaurant, with menu pricing and online ordering.' },
  { slug: 'barber-shop-landing', file: 'page-85-layout-4.json', title: 'Barber Shop', type: 'full_landing', niche: 'agency', style: 'dark', colors: ['monochrome', 'orange'], description: 'A dark, refined landing page for a barber shop — services, pricing, gallery and booking.' },
  { slug: 'tech-startup-landing', file: 'page-86-layout-5.json', title: 'Tech & AI Startup', type: 'full_landing', niche: 'saas', style: 'dark', colors: ['purple', 'blue'], description: 'A futuristic dark landing page for a tech / AI startup, with R&D, features and case studies.' },
] as const;

async function main(): Promise<void> {
  const shotDir = join(process.cwd(), 'public', 'screenshots');
  const jsonDir = join(process.cwd(), 'pipeline', 'out', 'layouts-json');
  await mkdir(shotDir, { recursive: true });
  await mkdir(jsonDir, { recursive: true });

  const { deps, close } = await realRenderDeps();
  try {
    for (const d of DEMO) {
      const raw = JSON.parse(await readFile(join(FIXDIR, d.file), 'utf8')) as { post_content?: string };
      const postContent = raw.post_content;
      if (!postContent) {
        console.warn(`  ! ${d.slug}: no post_content in ${d.file}, skipping`);
        continue;
      }
      console.log(`rendering ${d.slug}…`);
      const result = await renderLayout({ title: d.title, postContent }, deps);
      if (result.outcome === 'blank') {
        console.warn(`  ! ${d.slug}: page never confirmably painted content, skipping`);
        continue;
      }
      const { shots, perceptualHash } = result;
      const desktop = shots.find((s) => s.label === 'desktop') ?? shots[0];

      await writeFile(join(shotDir, `${d.slug}.png`), desktop.buffer);
      const jsonKey = join('pipeline', 'out', 'layouts-json', `${d.slug}.json`);
      await writeFile(join(process.cwd(), jsonKey), postContent, 'utf8');

      const contentHash = createHash('sha256').update(postContent).digest('hex');
      await db.delete(layouts).where(eq(layouts.slug, d.slug));
      await db.insert(layouts).values({
        id: randomUUID(),
        slug: d.slug,
        title: d.title,
        description: d.description,
        type: d.type,
        niche: d.niche,
        style: d.style,
        colors: [...d.colors],
        diviJsonBlobKey: jsonKey,
        previewImageKeys: [`/screenshots/${d.slug}.png`],
        contentHash,
        perceptualHash,
        validatorPassed: true,
        seo: { metaTitle: `${d.title} — Free Divi 5 Layout`, metaDescription: d.description },
        status: 'published',
        publishedAt: new Date(),
      });
      console.log(`  ✓ ${d.slug}  (phash ${perceptualHash?.slice(0, 12)}…, ${(desktop.buffer.length / 1024).toFixed(0)} KB)`);
    }
  } finally {
    await close();
  }
  console.log('done — open /browse to see the real screenshots.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
