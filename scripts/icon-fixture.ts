// scripts/icon-fixture.ts — builds the icon render-verify fixture (rich-
// generator spec §5.4): one page showing (A) every ICON_CATALOG glyph labeled
// with its claimed name+code — a wrong NAME shows up as a mismatched picture —
// and (B) every ETModules (divi) cmap codepoint labeled by hex, the source
// material for naming/tagging divi glyphs in a later pass. Render it with:
//   npx tsx scripts/icon-fixture.ts && npm run render -- pipeline/out/icon-fixture.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICON_CATALOG } from '@/pipeline/recipes/icons';
import codepoints from '@/pipeline/recipes/divi-icon-codepoints.json';

// The icon attribute shape below is copied from the validator repo's real
// recipes (section-recipes.json blurbs): imageIcon.innerContent.desktop.value
// = { useIcon:"on", icon:{ unicode, type, weight } }. Do NOT restructure it —
// a wrong path renders empty cells and defeats the fixture.
function blurb(label: string, unicode: string, type: 'fa' | 'divi', weight: string): string {
  const attrs = JSON.stringify({
    imageIcon: {
      innerContent: {
        desktop: { value: { useIcon: 'on', icon: { unicode: `&#x${unicode};`, type, weight } } },
      },
    },
    // Divi 5 blurb title.innerContent.desktop.value is { text } (an object),
    // NOT a bare string — verified against real recipes (section-recipes.json,
    // e.g. divi/blurb {"title":{...."value":{"text":"Learn More"}}}). A bare
    // string here silently renders no label text, defeating the fixture's
    // purpose (labels are how the human eyeball maps glyph -> claimed name).
    title: { innerContent: { desktop: { value: { text: label } } } },
    module: { advanced: { text: { text: { desktop: { value: { orientation: 'center' } } } } } },
  });
  return `<!-- wp:divi/blurb ${attrs} /-->`;
}

function section(heading: string, cells: string[]): string {
  const cols = cells
    .map((c) => `<!-- wp:divi/column {"module":{"decoration":{"sizing":{"desktop":{"value":{"flexType":"6_24"}}}}}} -->${c}<!-- /wp:divi/column -->`)
    .join('');
  return (
    `<!-- wp:divi/section {} --><!-- wp:divi/row {"module":{"decoration":{"layout":{"desktop":{"value":{"display":"flex","flexWrap":"wrap","columnGap":"16px","rowGap":"24px"}}}}}} -->` +
    `<!-- wp:divi/column {} --><!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":"${heading}"}}}} /--><!-- /wp:divi/column -->` +
    cols +
    `<!-- /wp:divi/row --><!-- /wp:divi/section -->`
  );
}

function main(): void {
  const catalogCells = ICON_CATALOG.map((e) => blurb(`${e.name} ${e.unicode}/${e.weight}`, e.unicode, e.type, e.weight));
  const diviCells = (codepoints.divi as string[]).map((hex) => blurb(hex, hex, 'divi', '400'));
  const post_content =
    section('CATALOG — name must match the glyph', catalogCells) +
    section('ETMODULES INVENTORY — unnamed, label is the hex code', diviCells);
  const out = { post_title: 'Icon Fixture', post_content };
  mkdirSync(join(__dirname, '..', 'pipeline', 'out'), { recursive: true });
  const file = join(__dirname, '..', 'pipeline', 'out', 'icon-fixture.json');
  writeFileSync(file, JSON.stringify(out));
  console.log(`wrote ${file} (${catalogCells.length} catalog + ${diviCells.length} divi glyph cells)`);
}

main();
