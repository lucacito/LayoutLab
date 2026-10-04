import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PRICING } from '@/lib/pricing/config';

// Every AI Editor price, tier name price, site limit and cap lives in config/pricing.json. Nothing else may type
// them: rendered copy uses formatUsd(PRICING...) so changing the config changes the whole site.
// Converter prices (a different amount) are out of scope.

const ROOT = process.cwd();
const SCAN = ['app', 'components', 'content', 'lib'];
const EXT = /\.(tsx?|md|txt)$/;
const ALLOWED = new Set(['lib/pricing/config.ts']);

export function literalsIn(text: string, tiers: number[], lifetime: number): string[] {
  const dollars = [...tiers, lifetime].map((c) => c / 100);
  const cents = [...tiers, lifetime];
  const found: string[] = [];
  for (const d of dollars) {
    const m = text.match(new RegExp(`\\$\\s?${d}(?!\\d|,\\d)`, 'g'));
    if (m) found.push(...m);
  }
  for (const c of cents) {
    const m = text.match(new RegExp(`(?<![\\d.]|\\d,)${c}(?!\\d|,\\d)`, 'g'));
    if (m) found.push(...m);
  }
  return found;
}

const tiers = PRICING.tiers.map((t) => t.priceCents);
const lifetime = PRICING.lifetime.priceCents;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(e)) out.push(full);
  }
  return out;
}

describe('pricing literals guard', () => {
  it('the matcher finds typed prices and ignores unrelated numbers', () => {
    const hit = literalsIn('Personal is $49/yr, or 4900 cents, or $ 149, and Lifetime costs $449.', tiers, lifetime);
    expect(hit.sort()).toEqual(['$ 149', '$449', '$49', '4900'].sort());
    expect(literalsIn('Founded in 2049, 14 900 words, $490, $1,499, version 4.9.0, id 49001, 2025-04-90', tiers, lifetime)).toEqual([]);
  });

  const files = SCAN.flatMap((d) => walk(join(ROOT, d))).map((f) => ({ rel: relative(ROOT, f), text: readFileSync(f, 'utf8') }));

  it('scans the places prices tend to hide in', () => {
    const rels = files.map((f) => f.rel);
    for (const must of ['app/llms.txt/route.ts', 'lib/email/license-email.ts', 'lib/nav/menu-data.ts', 'components/marketing/ProductDoors.tsx', 'app/(catalog)/pricing/page.tsx']) {
      expect(rels).toContain(must);
    }
  });

  it('no AI Editor price is typed outside config/pricing.json', () => {
    const offenders = files
      .filter((f) => !ALLOWED.has(f.rel))
      .flatMap((f) => literalsIn(f.text, tiers, lifetime).map((h) => `${f.rel}: ${h}`));
    expect(offenders).toEqual([]);
  });
});
