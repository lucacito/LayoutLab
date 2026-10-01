import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guards the AI Editor Pro pause (lib/site/pro-status.ts). While the plan is
// paused nothing the site renders may sell it, and the product id may only
// appear in the checkout plumbing. If you are relaunching Pro, flip the switch
// and update this guard together with the copy.
import { AI_EDITOR_PRO_AVAILABLE } from '@/lib/site/pro-status';

const ROOT = process.cwd();
const SCAN = ['app', 'components', 'content', 'lib'];
const EXT = /\.(tsx?|md|txt)$/;
// Backend plumbing that legitimately still knows about the product.
const PLUMBING = new Set([
  'app/api/checkout/route.ts',
  'lib/site/pro-status.ts',
  'lib/stripe/checkout.ts',
  'lib/env.ts',
]);
const isPlumbing = (rel: string) => PLUMBING.has(rel) || rel.startsWith('lib/license-server/') || rel.startsWith('lib/stripe/');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(e)) out.push(full);
  }
  return out;
}

const files = SCAN.flatMap((d) => walk(join(ROOT, d))).map((f) => ({
  rel: relative(ROOT, f),
  text: readFileSync(f, 'utf8'),
}));

describe.skipIf(AI_EDITOR_PRO_AVAILABLE)('AI Editor Pro is paused', () => {
  it('ai-editor-divi5-pro never appears in app/, components/ or content/ outside the checkout route', () => {
    const offenders = files
      .filter((f) => !isPlumbing(f.rel) && f.text.includes('ai-editor-divi5-pro'))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('no rendered BuyProButton targets the AI Editor product', () => {
    const offenders = files
      .filter((f) => /<BuyProButton[^>]*ai-editor/.test(f.text))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('no $30 price or 45-day trial is rendered anywhere (outside the Stripe/licence backend)', () => {
    const offenders = files
      .filter((f) => !isPlumbing(f.rel) && /\$\s?30\b|45-day|45 day/i.test(f.text))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('the AI Editor connect guides sell nothing: no price, trial, licence or Pro unlock', () => {
    const guides = files.filter((f) => /^content\/guides\/connect-.*-to-divi-5\.md$/.test(f.rel));
    expect(guides.length).toBe(3);
    for (const g of guides) {
      expect(g.text, g.rel).not.toMatch(/\$\s?30|trial|licen[sc]e|unlocks|upgrade/i);
      expect(g.text, g.rel).not.toMatch(/free vs\.? pro/i);
      // the only Pro mention is the single "planned add-on" sentence
      const proMentions = g.text.match(/\bPro\b/g) ?? [];
      expect(proMentions.length, g.rel).toBe(1);
      expect(g.text, g.rel).toMatch(/Pro add-on[^.]*planned[^.]*not available yet/i);
    }
  });

  it('the AI Editor surfaces (menu, doors, pricing card, llms.txt) carry no price or purchase wording', () => {
    for (const rel of ['lib/nav/menu-data.ts', 'components/marketing/ProductDoors.tsx', 'app/llms.txt/route.ts']) {
      const f = files.find((x) => x.rel === rel)!;
      const aiLines = f.text.split('\n').filter((l) => /ai.editor|divi-5-ai-editor/i.test(l));
      expect(aiLines.length, rel).toBeGreaterThan(0);
      for (const l of aiLines) expect(l, `${rel}: ${l}`).not.toMatch(/\$\d|trial|pro\s*\$/i);
    }
  });
});
