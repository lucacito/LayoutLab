// Publish the "import file with the pack's global colors and module presets" for each page of a theme pack.
// The store keeps every page as plain literal Divi content (previews and the render checks need that). For a pack that has
// been through the validator's globalize/presetize steps, this script builds the second file Divi's importer can take with
// the pack's colors and presets inside, and uploads it to the same Blob store under portable/<contentHash>.json.
// The download routes serve it when it exists (lib/download/portable.ts) and fall back to the plain page otherwise.
//
// What it does, per pack:
//   1. reads the pack's pages as the store holds them (LOCAL database + Blob), writes them to <validator>/dist/portable/<id>/stored
//   2. runs the validator's scripts/theme-packs/globalize.php and presetize.php on them (the logic Divi 5.15.1 verified lives there)
//   3. builds one import file per page, refuses anything unsound, and uploads it (dry run unless --confirm)
//
// Usage: bash scripts/portable-publish.sh <id>                 (dry run: builds everything, uploads nothing)
//        bash scripts/portable-publish.sh <id> --confirm       (uploads)
//        bash scripts/portable-publish.sh <id> --remove        (deletes the uploaded files again: the pack goes back to plain pages)
// Needs the validator checkout (VALIDATOR_DIR, default ../Divi 5 Deterministic Validator) with scripts/theme-packs/<id>.php.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { del, put } from '@vercel/blob';
import * as schema from '@/db/schema';
import { layouts, packLayouts, packs } from '@/db/schema';
import { slugify } from '@/pipeline/seo';
import { fetchAsset } from '@/lib/blob';
import { toDiviPortability, type PortabilityExtras } from '@/lib/download/portability';
import { isSoundPortable, portableUrl } from '@/lib/download/portable';
import type { PackConfig } from './pack-create';

const CONFIRM = process.argv.includes('--confirm');
const REMOVE = process.argv.includes('--remove');
const ID = process.env.PACK;
if (!ID) throw new Error('set PACK=<id>');
// Packs made from a scripts/packs/<id>.json config find their pages by the config's slug formula. The older packs were made by
// their own create-<id>-pack.ts scripts and have no config: their pages are found through the pack's slug in the database, and
// <id> is the name of the validator spec (scripts/theme-packs/<id>.php).
const OLDER_PACK_SLUGS: Record<string, string> = {
  tidewell: 'tidewell-wellness-studio-theme', haldenrow: 'halden-row-interior-design-theme', ironbound: 'ironbound-strength-gym-theme',
  wagtail: 'wagtail-veterinary-clinic-theme', copperline: 'copperline-plumbing-theme', anvil: 'anvil-commercial-plumbing-theme',
  fieldnote: 'fieldnote-coffee-roaster-theme', larkfield: 'larkfield-private-school-theme', nullbyte: 'nullbyte-cybersecurity-theme',
  bureau: 'bureau-creative-agency-theme', nightshift: 'nightshift-creative-studio-theme',
};
const CFG = existsSync(`scripts/packs/${ID}.json`) ? (JSON.parse(readFileSync(`scripts/packs/${ID}.json`, 'utf8')) as PackConfig) : null;
if (!CFG && !OLDER_PACK_SLUGS[ID]) throw new Error(`no scripts/packs/${ID}.json and ${ID} is not a known older pack`);
const VALIDATOR = resolve(process.env.VALIDATOR_DIR ?? '../Divi 5 Deterministic Validator');
const WORK = `${VALIDATOR}/dist/portable/${ID}`;
let ROLES: { role: string; slug: string }[] = (CFG?.roles ?? []).map((r) => ({ role: r.role, slug: slugify(`${CFG!.businessName} ${CFG!.style} ${CFG!.niche} ${r.role} page for divi 5`) }));

function php(script: string, args: string[]): void {
  console.log(execFileSync('php', [`${VALIDATOR}/scripts/theme-packs/${script}`, ...args], { cwd: VALIDATOR, encoding: 'utf8' }).trim().split('\n').slice(-1)[0]);
}

async function main() {
  const localUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!localUrl || !/localhost|127\.0\.0\.1/.test(localUrl)) throw new Error('local POSTGRES_URL must point at the local dev database');
  const pool = new Pool({ connectionString: localUrl });
  const db = drizzle(pool, { schema });
  try {
    if (!CFG) {
      const inPack = await db.select({ slug: layouts.slug }).from(packLayouts)
        .innerJoin(packs, eq(packLayouts.packId, packs.id)).innerJoin(layouts, eq(packLayouts.layoutId, layouts.id))
        .where(eq(packs.slug, OLDER_PACK_SLUGS[ID!]));
      if (inPack.length === 0) throw new Error(`pack ${OLDER_PACK_SLUGS[ID!]} has no pages in the local database`);
      ROLES = inPack.map((r) => ({ role: r.slug.replace(/-page-for-divi-5$/, '').slice(-60), slug: r.slug })).sort((a, b) => a.slug.localeCompare(b.slug));
    }
    const rows = await db.select().from(layouts).where(inArray(layouts.slug, ROLES.map((r) => r.slug)));
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const missing = ROLES.filter((r) => !bySlug.has(r.slug));
    if (missing.length) throw new Error(`not in the local database: ${missing.map((m) => m.slug).join(', ')}`);
    const target = (slug: string) => {
      const r = bySlug.get(slug)!;
      const url = portableUrl(r.diviJsonBlobKey, r.contentHash);
      if (!url) throw new Error(`${slug}: no https Blob URL / content hash, aborting`);
      return url;
    };

    if (REMOVE) {
      console.log(`[portable] ${ID}: removing ${ROLES.length} import files  confirm=${CONFIRM}`);
      for (const r of ROLES) {
        const url = target(r.slug);
        console.log(`   ${CONFIRM ? 'delete' : 'would delete'} ${url}`);
        if (CONFIRM) await del(url);
      }
      if (!CONFIRM) console.log('\n[portable] DRY-RUN: nothing deleted. Re-run with --confirm.');
      return;
    }

    // 1) the pages as the store holds them
    rmSync(WORK, { recursive: true, force: true });
    mkdirSync(`${WORK}/stored`, { recursive: true });
    for (const r of ROLES) {
      const row = bySlug.get(r.slug)!;
      if (row.validatorPassed !== true) throw new Error(`${r.slug} was not validated, aborting`);
      const bytes = await fetchAsset(row.diviJsonBlobKey);
      if (!bytes) throw new Error(`${r.slug}: stored layout is not readable, aborting`);
      writeFileSync(`${WORK}/stored/${r.role}.json`, bytes);
    }

    // 2) the validator steps (globalize colors, then move type and buttons into presets)
    php('globalize.php', [ID!, `${WORK}/global`, `${WORK}/stored`]);
    php('presetize.php', [ID!, `${WORK}/preset`, `${WORK}/global`]);
    const colors = JSON.parse(readFileSync(`${WORK}/preset/colors.json`, 'utf8')) as PortabilityExtras['globalColors'];
    const presets = JSON.parse(readFileSync(`${WORK}/preset/presets.json`, 'utf8')) as { module: Record<string, { items: Record<string, unknown> }> };
    const presetCount = Object.values(presets.module).reduce((n, m) => n + Object.keys(m.items).length, 0);
    if (!colors?.length || presetCount === 0) throw new Error('the pack produced no global colors or no presets, aborting');
    console.log(`[portable] ${ID}: ${colors.length} global colors, ${presetCount} presets, ${ROLES.length} pages  confirm=${CONFIRM}`);

    // 3) one import file per page
    const ours = new Set(Object.values(presets.module).flatMap((m) => Object.keys(m.items)));
    const files: { role: string; url: string; body: string }[] = [];
    for (const r of ROLES) {
      const page = readFileSync(`${WORK}/preset/${r.role}.json`, 'utf8');
      const body = toDiviPortability(page, { globalColors: colors, presets });
      if (!isSoundPortable(body)) throw new Error(`${r.role}: the import file is not sound, aborting`);
      const content = (JSON.parse(page) as { post_content: string }).post_content;
      const cited = [...content.matchAll(/modulePreset\\?":\[\\?"([0-9a-f-]{36})/g)].map((m) => m[1]);
      const unknown = cited.filter((id) => !ours.has(id));
      if (unknown.length) throw new Error(`${r.role}: cites presets that are not in the pack: ${[...new Set(unknown)].join(', ')}`);
      files.push({ role: r.role, url: target(r.slug), body });
      console.log(`   ${r.role.padEnd(11)} ${String(body.length).padStart(7)} B  ${cited.length} preset refs  -> ${files[files.length - 1].url.replace(/^https:\/\/[^/]+/, '')}`);
    }
    if (!CONFIRM) {
      console.log('\n[portable] DRY-RUN: nothing uploaded. Re-run with --confirm.');
      return;
    }
    for (const f of files) {
      const key = new URL(f.url).pathname.replace(/^\//, '');
      // A short cache so a corrected file is picked up within a minute (Blob's default is a month).
      const res = await put(key, f.body, { access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 });
      console.log(`   uploaded ${f.role}: ${res.url === f.url ? 'ok' : `URL MISMATCH ${res.url}`}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
