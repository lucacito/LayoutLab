// scripts/extract-divi-icons.ts — ONE-SHOT cmap extraction (rich-generator
// spec §5.4). Copies the icon fonts out of the running render-env container,
// parses each font's cmap with opentype.js, and writes the full codepoint
// inventory to pipeline/recipes/divi-icon-codepoints.json (checked in).
//
// That JSON is the GROUND TRUTH the icon catalog is tested against
// (tests/icons.test.ts asserts catalog ⊆ cmap) — a wrong unicode fails CI,
// not a render. Re-run this script only after a Divi/theme update, then
// re-commit the JSON. CI never runs this script (needs Docker).
//
// Usage: npx tsx scripts/extract-divi-icons.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'opentype.js';

const CONTAINER = 'divi5val_wp';
const FONTS: Record<string, string> = {
  divi: '/var/www/html/wp-content/themes/Divi/core/admin/fonts/modules/all/modules.ttf',
  'fa-solid-900': '/var/www/html/wp-content/themes/Divi/core/admin/fonts/fontawesome/fa-solid-900.ttf',
  'fa-regular-400': '/var/www/html/wp-content/themes/Divi/core/admin/fonts/fontawesome/fa-regular-400.ttf',
};
const OUT = join(__dirname, '..', 'pipeline', 'recipes', 'divi-icon-codepoints.json');

function codepointsOf(ttf: Buffer): string[] {
  const font = parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
  const seen = new Set<string>();
  const glyphMap = (font.tables.cmap as unknown as { glyphIndexMap: Record<string, number> })
    .glyphIndexMap;
  for (const cp of Object.keys(glyphMap)) {
    const n = Number(cp);
    if (Number.isFinite(n) && n > 0x20) seen.add(n.toString(16));
  }
  return [...seen].sort();
}

function main(): void {
  const tmp = mkdtempSync(join(tmpdir(), 'divi-fonts-'));
  const out: Record<string, string[]> = {};
  try {
    for (const [bucket, path] of Object.entries(FONTS)) {
      const local = join(tmp, `${bucket}.ttf`);
      execFileSync('docker', ['cp', `${CONTAINER}:${path}`, local], { stdio: 'inherit' });
      out[bucket] = codepointsOf(readFileSync(local));
      console.log(`${bucket}: ${out[bucket].length} codepoints`);
    }
  } catch (e) {
    console.error(
      `extraction failed — is the render env up? (docker ps should list ${CONTAINER})\n`,
      e instanceof Error ? e.message : e,
    );
    process.exit(1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
}

main();
