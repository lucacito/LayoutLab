// Fix/polish an ALREADY-PUBLISHED layout in place (its JSON + screenshots), so the
// change shows on the live site. Ingest can't UPDATE (insert-or-dedupe), so we patch
// the block markup → validate → re-render → upload under NEW hash keys → update the
// layouts row. Local + prod share ONE blob store, so new assets are reachable by both.
//
// Usage (via wrapper, no prompts):  bash scripts/fix-live-layout.sh <slug>
//   local only:   PATCH_TARGET=local  npx tsx scripts/patch-live-layout.ts <slug>
//   also prod:    PATCH_TARGET=both   ... (needs prod POSTGRES_URL exported)
//
// Patches are keyed by slug in PATCHES below. Each is a pure (postContent)=>postContent
// string transform that MUST change the content (asserted) and stay valid (asserted).
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { layouts } from '@/db/schema';

// TARGET_DB_URL points the patch at prod (Neon unpooled) or local; default local.
const connectionString = process.env.TARGET_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const db = drizzle(new Pool({ connectionString }), { schema });
import { validateLayout } from '@/pipeline/validate';
import { contentHash } from '@/pipeline/dedupe';
import { uploadLayout, uploadScreenshot } from '@/pipeline/upload';
import { realRenderDeps, renderLayout } from '@/pipeline/render';

type Patch = (postContent: string) => string;

// ── Patch registry ───────────────────────────────────────────────────────────
const PATCHES: Record<string, Patch> = {
  // Menu hero: the photo actually fills its column — what looks "not full-width /
  // bad" is the column's heavy drop shadow (preset3: 32px offset, 64px blur)
  // haloing right/top on the cream background, reading as an oversized floating
  // card. Remove that box shadow (keep the rounded, overflow-clipped photo). Also
  // revert the earlier no-op width/forceFullwidth addition so the diff is clean.
  'bella-nota-elegant-restaurant-menu-page-for-divi-5': (c) => {
    let out = c;
    // revert prior no-op patch, if present
    out = out.replace(
      ',"module":{"decoration":{"sizing":{"desktop":{"value":{"width":"100%","forceFullwidth":"on"}}}}}',
      '',
    );
    // remove the column's box shadow (unique by its rgba(42,30,23,0.22) color)
    const shadow =
      ',"boxShadow":{"desktop":{"value":{"style":"preset3","horizontal":"0px","vertical":"32px","blur":"64px","color":"rgba(42,30,23,0.22)"}}}';
    if (!out.includes(shadow)) throw new Error('menu hero column box shadow not found (already patched?)');
    out = out.replace(shadow, '');
    return out;
  },

  // Steakhouse hero: eyebrow/headline/body are centered, but the inline-block
  // button sits left. `orientation:center` and a module `alignment` don't move it.
  // Make the COLUMN a centered flex column so the button centers (text blocks keep
  // their centered text + maxWidth). Also revert the earlier no-op alignment attr.
  // Idempotent: applies whichever sub-fixes still apply (button centering + eyebrow).
  'bold-steakhouse-hero-section-for-divi-5-dark-monochrome-restaurant-layout': (c) => {
    let out = c;
    // 1. Eyebrow placeholder "A Tiny Label" → a real on-theme label.
    out = out.replace(
      '"innerContent":{"desktop":{"value":"A Tiny Label"}}',
      '"innerContent":{"desktop":{"value":"Wood-Fired Steakhouse"}}',
    );
    // 2. Revert the earlier no-op module alignment attempt, if present.
    out = out.replace(
      '"module":{"advanced":{"text":{"text":{"desktop":{"value":{"orientation":"center"}}}}},"decoration":{"alignment":{"desktop":{"value":"center"}}}},"button":',
      '"module":{"advanced":{"text":{"text":{"desktop":{"value":{"orientation":"center"}}}}}},"button":',
    );
    // 3. Center the button by making the column a centered flex column (if not already).
    const colBefore = '"layout":{"desktop":{"value":{"display":"block"}}},"sizing":{"phone":{"value":{"flexType":"24_24"}}}';
    const colAfter = '"layout":{"desktop":{"value":{"display":"flex","flexDirection":"column","alignItems":"center"}}},"sizing":{"phone":{"value":{"flexType":"24_24"}}}';
    if (out.includes(colBefore)) out = out.replace(colBefore, colAfter);
    if (out === c) throw new Error('steakhouse: nothing left to change (already patched)');
    return out;
  },

  // Coaching footer: row 1 is a flex/flex-wrap row with four 1_4 columns (brand,
  // Coaching, Explore, newsletter) but the columns set only a *phone* width, so on
  // desktop they have no width → collapse full-width → stack. Give the Coaching and
  // Explore columns a real desktop width (~46% each) so they sit side by side;
  // brand + newsletter stay full-width (they wrap onto their own rows).
  'playful-pastel-coaching-footer-free-divi-5-layout': (c) => {
    const colOpen =
      '<!-- wp:divi/column {"module":{"advanced":{"type":{"desktop":{"value":"1_4"}}},"decoration":{"sizing":{"phone":{"value":{"flexType":"24_24"}}}}},"builderVersion":"5.8.0"} -->';
    const colWide =
      '<!-- wp:divi/column {"module":{"advanced":{"type":{"desktop":{"value":"1_4"}}},"decoration":{"sizing":{"desktop":{"value":{"flexType":"11_24"}},"phone":{"value":{"flexType":"24_24"}}}}},"builderVersion":"5.8.0"} -->';
    const parts = c.split(colOpen);
    // Occurrences (in order): 1=brand, 2=Coaching, 3=Explore. Widen #2 and #3 only.
    if (parts.length < 4) throw new Error(`expected >=3 identical 1_4 columns, found ${parts.length - 1} (already patched?)`);
    let out = parts[0];
    for (let i = 1; i < parts.length; i++) {
      out += (i === 2 || i === 3 ? colWide : colOpen) + parts[i];
    }
    if (out === c) throw new Error('coaching footer: no change');
    return out;
  },

  // Reservations: the model drifted from brandFacts and put 4 different phone
  // numbers on one page (hero/contact/CTA invented; only the FAQ had the canonical
  // (415) 555-0148). Canonicalize every (415) number to the real one.
  'bella-nota-elegant-restaurant-reservations-page-for-divi-5': (c) => {
    const out = c.replace(/\(415\) \d{3}-\d{4}/g, '(415) 555-0148');
    if (out === c) throw new Error('reservations: no (415) phone numbers found');
    return out;
  },

  // Contact page: same phone drift — 4 different (415) numbers. Canonicalize.
  'bella-nota-elegant-restaurant-contact-page-for-divi-5': (c) => {
    const out = c.replace(/\(415\) \d{3}-\d{4}/g, '(415) 555-0148');
    if (out === c) throw new Error('contact: no (415) phone numbers found');
    return out;
  },

  // Maison Verity consultation, Final CTA: eyebrow/headline/body are centered but
  // the inline-block button sits left — `orientation:center` on the button module
  // doesn't move it (same failure mode as the steakhouse hero above). Make the
  // final section's COLUMN a centered flex column; text blocks keep their centered
  // text (the body copy keeps its maxWidth + auto margins). Scoped to the LAST
  // section only so the other five sections' identical block columns are untouched.
  'maison-verity-elegant-real-estate-private-consultation-page-for-divi-5': (c) => {
    const idx = c.lastIndexOf('<!-- wp:divi/section');
    if (idx < 0) throw new Error('consultation: no section found');
    const head = c.slice(0, idx);
    const tail = c.slice(idx);
    if (!tail.includes('"adminLabel":{"desktop":{"value":"Final CTA"}}')) {
      throw new Error('consultation: last section is not the Final CTA');
    }
    const colBefore = '"decoration":{"layout":{"desktop":{"value":{"display":"block"}}},"sizing":{"phone":{"value":{"flexType":"24_24"}}}}';
    const colAfter = '"decoration":{"layout":{"desktop":{"value":{"display":"flex","flexDirection":"column","alignItems":"center"}}},"sizing":{"phone":{"value":{"flexType":"24_24"}}}}';
    if (!tail.includes(colBefore)) throw new Error('consultation: final CTA column layout not found (already patched?)');
    return head + tail.replace(colBefore, colAfter);
  },

  // Maison Verity residences, FAQ button: the label sits LEFT inside the button
  // when the button stretches full-width on phone (the column IS a centered flex
  // column, but phone collapses it and the block-level button fills the width, so
  // the wrapped 2-line label exposes its left alignment; the final-CTA button has
  // the same stretch but its one-line label masks it). Module-level
  // `orientation:center` (sub-fix 1) did NOT reach the label — the label obeys the
  // button FONT's own textAlign, so sub-fix 2 sets that. Idempotent: applies
  // whichever sub-fixes still apply. Both targets verified unique (the hero
  // button's font differs: letterSpacing 1.5px, color #F5F3FF).
  'maison-verity-elegant-real-estate-residences-page-for-divi-5': (c) => {
    let out = c;
    // 1. orientation:center on the button module (kept from the first attempt).
    out = out.replace(
      '"builderVersion":"5.0.0-public-beta.1","modulePreset":["default"],"module":{"decoration":{"layout":{"desktop":{"value":{"display":"block"}}}}}} /-->',
      '"builderVersion":"5.0.0-public-beta.1","modulePreset":["default"],"module":{"advanced":{"text":{"text":{"desktop":{"value":{"orientation":"center"}}}}},"decoration":{"layout":{"desktop":{"value":{"display":"block"}}}}}} /-->',
    );
    // 2. textAlign:center on the button font — what the label actually obeys.
    out = out.replace(
      '{"family":"Outfit","weight":"600","size":"15px","letterSpacing":"1px","color":"#FFFFFF"}',
      '{"family":"Outfit","weight":"600","size":"15px","letterSpacing":"1px","color":"#FFFFFF","textAlign":"center"}',
    );
    if (out === c) throw new Error('residences: nothing left to change (already patched)');
    return out;
  },
};

async function withTempFile<T>(json: string, fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'patch-'));
  const file = join(dir, 'layout.json');
  await writeFile(file, json);
  try { return await fn(file); } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error('usage: patch-live-layout.ts <slug>'); process.exit(1); }
  // PATCH_MODE=phone → canonicalize every (415) number to the brandFacts one,
  // regardless of slug (systemic Bella Nota phone drift). Else use the registry.
  const canonPhone = process.env.CANON_PHONE || '(415) 555-0148'; // Bella Nota default
  const phoneCanon: Patch = (c) => {
    const o = c.replace(/\(415\) \d{3}-\d{4}/g, canonPhone);
    if (o === c) throw new Error('no (415) phone numbers found');
    return o;
  };
  const patch = process.env.PATCH_MODE === 'phone' ? phoneCanon : PATCHES[slug];
  if (!patch) { console.error(`no patch registered for slug: ${slug}`); process.exit(1); }

  const [row] = await db.select().from(layouts).where(eq(layouts.slug, slug)).limit(1);
  if (!row) { console.error(`layout not found: ${slug}`); process.exit(1); }
  console.log(`[patch] ${slug}\n  current json: ${row.diviJsonBlobKey}`);

  // 1. Fetch current JSON.
  const res = await fetch(row.diviJsonBlobKey);
  if (!res.ok) throw new Error(`fetch json ${res.status}`);
  const doc = (await res.json()) as { post_title?: string; post_content: string };

  // 2. Patch.
  const patched = patch(doc.post_content);
  if (patched === doc.post_content) throw new Error('patch produced no change');
  const newDoc = JSON.stringify({ ...doc, post_content: patched });

  // 3. Validate (hard gate).
  const verdict = await withTempFile(newDoc, (f) => validateLayout(f));
  if (!verdict.valid) {
    console.error('[patch] VALIDATION FAILED:', verdict.violations.map((v) => v.code).join(','));
    process.exit(1);
  }
  console.log('[patch] validator: PASS');

  // 4. New content hash + assets.
  const hash = contentHash(newDoc);
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const { deps, close } = await realRenderDeps();
  let previewImageKeys = row.previewImageKeys ?? [];
  let perceptualHash = row.perceptualHash ?? undefined;
  try {
    console.log('[patch] rendering…');
    const result = await renderLayout({ title: doc.post_title ?? row.title, postContent: patched }, deps);
    if (result.outcome === 'blank') {
      // Review fix (T2.1): a blank render must not clobber the live layout's
      // existing perceptualHash (or previewImageKeys) with an empty/undefined
      // value — keep whatever's already on the row and warn instead.
      console.warn(`[patch] render blank for ${slug}: page never confirmably painted content — keeping existing previewImageKeys/perceptualHash`);
    } else {
      const { shots, perceptualHash: ph } = result;
      perceptualHash = ph;
      const keys: string[] = [];
      for (const label of ['desktop', 'mobile'] as const) {
        const shot = shots.find((s) => s.label === label);
        if (shot) keys.push(await uploadScreenshot(hash, label, shot.buffer, { hasBlobToken }));
      }
      if (keys.length) previewImageKeys = keys;
    }
  } finally { await close(); }

  const { diviJsonBlobKey } = await uploadLayout(hash, newDoc, { hasBlobToken, outDir: 'pipeline/out' });

  // 5. Update the row (local DB the client is pointed at).
  await db.update(layouts)
    .set({ diviJsonBlobKey, previewImageKeys, contentHash: hash, perceptualHash })
    .where(eq(layouts.slug, slug));

  const refs = { slug, diviJsonBlobKey, previewImageKeys, contentHash: hash, perceptualHash };
  console.log('[patch] updated local row. New refs:');
  console.log(JSON.stringify(refs, null, 2));
  console.log(`[patch] desktop preview: ${previewImageKeys.find((k) => k.includes('desktop')) ?? previewImageKeys[0]}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
