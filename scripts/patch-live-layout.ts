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

  // Caldwell & Pierce law-firm landing: five defects found on visual review.
  //   1. Phone drift (same generator flaw as the Bella Nota pages): four invented
  //      (312) numbers + one tel: link. Canonicalize to brandFacts' (312) 555-0177.
  //   2. Final-CTA photo was a German police officer ("Polizei" vest) — swap for a
  //      verified Pexels photo of an attorney in a dark suit (26150470).
  //   3. Testimonial avatar #3 (family-law client) was a CHILD (pravatar random
  //      seed) — swap for a verified adult professional headshot (Pexels 7860654).
  //   4. Gallery grid hole: rows were 1|2 and 2|1 images per column (all photos
  //      share the same 3:2 aspect, so the 1-image columns left big white gaps).
  //      Move one image to make row2 = 2|2 and row3 = 1|1 — and since the moved
  //      image was an off-brand key-in-a-door photo, retarget it to a verified
  //      contract-signing photo (8730998) with a matching alt.
  //   5. Mismatched practice-card icons (monitor=Family Law, wrench=Litigation,
  //      phone=Real Estate…) — remap all 9 blurb icons to semantically correct FA
  //      glyphs. NOTE: the six practice-card icon objects are double-escaped in
  //      the attr JSON (literal &), the three step-card ones are plain &.
  'caldwell-pierce-corporate-legal-landing-page-for-divi-5': (c) => {
    let out = c;
    // 1. Phones (five text occurrences across 4 invented numbers + tel: href).
    out = out.replace(/\(312\) \d{3}-\d{4}/g, '(312) 555-0177');
    out = out.replace('tel:+13126428140', 'tel:+13125550177');
    // 2. Final-CTA image: Polizei photo → attorney portrait (same CDN params).
    out = out.replace(
      'photos/9486944/pexels-photo-9486944.jpeg',
      'photos/26150470/pexels-photo-26150470.jpeg',
    );
    // 3. Testimonial avatar #3: child → adult professional headshot.
    out = out.replace(
      'https://i.pravatar.cc/300?u=caldwell-pierce-client-3',
      'https://images.pexels.com/photos/7860654/pexels-photo-7860654.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=300&h=300',
    );
    // 4. Gallery rebalance: cut the key-photo block (29940222) from row3-colA…
    const keyPos = out.indexOf('photos/29940222');
    if (keyPos < 0) throw new Error('lawfirm: key photo not found (already patched?)');
    const bStart = out.lastIndexOf('<!-- wp:divi/image', keyPos);
    const bEnd = out.indexOf(' /-->', bStart) + ' /-->'.length;
    let block = out.slice(bStart, bEnd);
    out = out.slice(0, bStart) + out.slice(bEnd);
    // …retarget it to the contract-signing photo…
    block = block
      .replace(/photos\/29940222\/pexels-photo-29940222\.jpeg/g, 'photos/8730998/pexels-photo-8730998.jpeg')
      .replace(
        "A reading corner in the firm's Monroe Street offices",
        'A client agreement prepared for signature — fees quoted in writing before work begins',
      );
    // …and insert it right after the conference-room image (13323673) in row2-colA.
    const confPos = out.indexOf('photos/13323673');
    if (confPos < 0) throw new Error('lawfirm: conference-room photo not found');
    const aStart = out.lastIndexOf('<!-- wp:divi/image', confPos);
    const aEnd = out.indexOf(' /-->', aStart) + ' /-->'.length;
    out = out.slice(0, aEnd) + block + out.slice(aEnd);
    // 5. Icons — practice cards (escaped & form; document order = card order).
    const esc = (u: string, t: string, w: string) => `{"unicode":"\\u0026#x${u};","type":"${t}","weight":"${w}"}`;
    const plain = (u: string, t: string, w: string) => `{"unicode":"&#x${u};","type":"${t}","weight":"${w}"}`;
    const iconSwaps: Array<[string, string]> = [
      [esc('e00e', 'divi', '400'), esc('f0c0', 'fa', '900')], // Family Law: monitor → users
      [esc('f518', 'fa', '900'), esc('f573', 'fa', '900')], // Estate: book-open → file-signature
      [esc('f201', 'fa', '900'), esc('f0b1', 'fa', '900')], // Business: chart-line → briefcase
      [esc('f0ad', 'fa', '900'), esc('f24e', 'fa', '900')], // Litigation: wrench → balance-scale
      [esc('e00b', 'divi', '400'), esc('f015', 'fa', '900')], // Real Estate: phone → home
      [esc('f590', 'fa', '900'), esc('f508', 'fa', '900')], // Employment: headset → user-tie
      [plain('e01d', 'divi', '400'), plain('f274', 'fa', '900')], // Step 1: pin → calendar-check
      [plain('f518', 'fa', '900'), plain('f086', 'fa', '900')], // Step 2: book-open → comments
      [plain('f201', 'fa', '900'), plain('f46c', 'fa', '900')], // Step 3: chart-line → clipboard-check
    ];
    for (const [from, to] of iconSwaps) {
      if (!out.includes(from)) throw new Error(`lawfirm: icon not found: ${from}`);
      out = out.replace(from, to);
    }
    if (out === c) throw new Error('lawfirm: no change');
    return out;
  },
};

// ── Generic patch: center un-centered CTA buttons (PATCH_MODE=center-buttons) ─
// The recurring generator flaw (see memory layoutlab-button-centering): in a
// centered-text column, `orientation:center` never moves the block/inline-block
// button, and on phone a stretched full-width button exposes a left-aligned
// label. Two proven sub-fixes, applied together:
//   1. Every column that contains BOTH a button module AND a centered-text
//      signal becomes a centered flex column (display:flex/column/alignItems:
//      center) — merged into its existing decoration.layout if present.
//   2. Every button module's font gets textAlign:center (no-op visually for
//      inline-block buttons, fixes the wrapped label in stretched ones).
// Attrs are JSON.parse'd and re-stringified (key insertion order preserved), so
// this works on any layout regardless of its exact serialized strings.
const COL_OPEN = '<!-- wp:divi/column ';
const COL_CLOSE = '<!-- /wp:divi/column -->';

function centerButtons(c: string): string {
  let changed = false;
  // 1. Centered-flex columns.
  let out = '';
  let i = 0;
  for (;;) {
    const start = c.indexOf(COL_OPEN, i);
    if (start < 0) { out += c.slice(i); break; }
    const jsonStart = start + COL_OPEN.length;
    const tagEnd = c.indexOf(' -->', jsonStart);
    if (tagEnd < 0) throw new Error('malformed column open tag');
    const close = c.indexOf(COL_CLOSE, tagEnd);
    if (close < 0) throw new Error('unclosed column');
    const attrsRaw = c.slice(jsonStart, tagEnd);
    const inner = c.slice(tagEnd + 4, close); // detection only; never rewritten here
    const hasButton = inner.includes('<!-- wp:divi/button ');
    const centered =
      attrsRaw.includes('"orientation":"center"') ||
      inner.includes('"orientation":"center"') ||
      inner.includes('"textAlign":"center"');
    let newAttrsRaw = attrsRaw;
    if (hasButton && centered) {
      const attrs = JSON.parse(attrsRaw);
      const val =
        ((((((attrs.module ??= {}).decoration ??= {}).layout ??= {}).desktop ??= {}).value ??= {}));
      if (val.display !== 'flex' || val.alignItems !== 'center') {
        val.display = 'flex';
        val.flexDirection = 'column';
        val.alignItems = 'center';
        newAttrsRaw = JSON.stringify(attrs);
        changed = true;
      }
    }
    out += c.slice(i, start) + COL_OPEN + newAttrsRaw + ' -->';
    i = tagEnd + 4; // continue right after the open tag (handles any nesting)
  }
  // 2. textAlign:center on every button font.
  out = out.replace(/<!-- wp:divi\/button ({.*?}) \/-->/g, (m, j: string) => {
    const attrs = JSON.parse(j);
    const val =
      (((((((attrs.button ??= {}).decoration ??= {}).font ??= {}).font ??= {}).desktop ??= {}).value ??= {}));
    if (val.textAlign === 'center') return m;
    val.textAlign = 'center';
    changed = true;
    return '<!-- wp:divi/button ' + JSON.stringify(attrs) + ' /-->';
  });
  if (!changed) throw new Error('center-buttons: nothing to change (no centered-text button column, all labels already centered)');
  return out;
}

// ── Generic patch pass 2: lone-button columns (PATCH_MODE=center-lone-buttons) ─
// centerButtons misses the common "features/testimonials grid + bottom CTA row"
// shape: the button sits ALONE in its own column, so the column itself has no
// centered-text signal. Center such a column only when its enclosing SECTION has
// centered text — measured with button modules stripped, so a button's own
// font.textAlign (added by pass 1) can't count as a signal and left-aligned
// designs (pulsegrid, fitness-cta) are left alone.
const SEC_OPEN = '<!-- wp:divi/section';
const SEC_CLOSE = '<!-- /wp:divi/section -->';
const BUTTON_RE = /<!-- wp:divi\/button {.*?} \/-->/g;

function centerLoneButtonColumns(c: string): string {
  let changed = false;
  let out = '';
  let i = 0;
  for (;;) {
    const sStart = c.indexOf(SEC_OPEN, i);
    if (sStart < 0) { out += c.slice(i); break; }
    const sEnd = c.indexOf(SEC_CLOSE, sStart);
    if (sEnd < 0) throw new Error('unclosed section');
    const secEnd = sEnd + SEC_CLOSE.length;
    let section = c.slice(sStart, secEnd);
    const nonButton = section.replace(BUTTON_RE, '');
    const sectionCentered =
      nonButton.includes('"orientation":"center"') || nonButton.includes('"textAlign":"center"');
    if (sectionCentered) {
      // rewrite lone-button columns inside this section
      let secOut = '';
      let j = 0;
      for (;;) {
        const cStart = section.indexOf(COL_OPEN, j);
        if (cStart < 0) { secOut += section.slice(j); break; }
        const jsonStart = cStart + COL_OPEN.length;
        const tagEnd = section.indexOf(' -->', jsonStart);
        const cClose = section.indexOf(COL_CLOSE, tagEnd);
        if (tagEnd < 0 || cClose < 0) throw new Error('malformed column in section');
        const attrsRaw = section.slice(jsonStart, tagEnd);
        const inner = section.slice(tagEnd + 4, cClose);
        const loneButton =
          inner.includes('<!-- wp:divi/button ') && inner.replace(BUTTON_RE, '').trim() === '';
        let newAttrsRaw = attrsRaw;
        if (loneButton) {
          const attrs = JSON.parse(attrsRaw);
          const val =
            ((((((attrs.module ??= {}).decoration ??= {}).layout ??= {}).desktop ??= {}).value ??= {}));
          if (val.display !== 'flex' || val.alignItems !== 'center') {
            val.display = 'flex';
            val.flexDirection = 'column';
            val.alignItems = 'center';
            newAttrsRaw = JSON.stringify(attrs);
            changed = true;
          }
        }
        secOut += section.slice(j, cStart) + COL_OPEN + newAttrsRaw + ' -->';
        j = tagEnd + 4;
      }
      section = secOut;
    }
    out += c.slice(i, sStart) + section;
    i = secEnd;
  }
  if (!changed) throw new Error('center-lone-buttons: nothing to change');
  return out;
}

// ── Generic patch: label-only (PATCH_MODE=center-labels) ──────────────────────
// Only sub-fix 2 of centerButtons: textAlign:center on every button font. For
// layouts where the columns must NOT be touched (e.g. a side-by-side button
// PAIR that flex-column would stack) but stretched full-width mobile buttons
// still show a left-aligned wrapped label.
function centerLabels(c: string): string {
  let changed = false;
  const out = c.replace(/<!-- wp:divi\/button ({.*?}) \/-->/g, (m, j: string) => {
    const attrs = JSON.parse(j);
    const val =
      (((((((attrs.button ??= {}).decoration ??= {}).font ??= {}).font ??= {}).desktop ??= {}).value ??= {}));
    if (val.textAlign === 'center') return m;
    val.textAlign = 'center';
    changed = true;
    return '<!-- wp:divi/button ' + JSON.stringify(attrs) + ' /-->';
  });
  if (!changed) throw new Error('center-labels: nothing to change');
  return out;
}

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
  const patch =
    process.env.PATCH_MODE === 'phone' ? phoneCanon
    : process.env.PATCH_MODE === 'center-buttons' ? centerButtons
    : process.env.PATCH_MODE === 'center-lone-buttons' ? centerLoneButtonColumns
    : process.env.PATCH_MODE === 'center-labels' ? centerLabels
    : PATCHES[slug];
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
