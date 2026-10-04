import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guard against price literals for the AI Editor Pro appearing outside config/pricing.json.
// Every price must come from PRICING at runtime; hardcoding them means:
// - the storefront and add-on can drift when prices change,
// - someone has to update the code, not just the config.
// Converter prices ($25) are out of scope; only the AI Editor amounts are checked.

import { PRICING } from '@/lib/pricing/config';

const ROOT = process.cwd();
const SCAN = ['app', 'components', 'content', 'lib'];
const EXT = /\.(tsx?|md|txt)$/;

// These directories and files are allowed to reference Stripe infra and backend plumbing,
// where price envs and product ids live but not rendered prices.
const PLUMBING = new Set([
  'app/api/checkout/route.ts',
  'app/api/billing/change-tier/route.ts',
  'lib/site/pro-status.ts',
  'lib/stripe/checkout.ts',
  'lib/pricing/stripe.ts',
  'lib/env.ts',
]);

const isPlumbing = (rel: string) =>
  PLUMBING.has(rel) ||
  rel.startsWith('lib/license-server/') ||
  rel.startsWith('lib/stripe/') ||
  rel.startsWith('scripts/');

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

describe('Pricing literals guard', () => {
  it('no AI Editor Pro price appears outside config/pricing.json', () => {
    // AI Editor price amounts (cents and dollars) that must not appear as literals.
    // Converters are $25/yr and are out of scope.
    const aiEditorCents = ['4900', '9900', '14900', '44900'];
    const aiEditorDollars = ['$49', '$99', '$149', '$449', '$ 49', '$ 99', '$ 149', '$ 449'];
    const allPrices = [...aiEditorCents, ...aiEditorDollars];

    const offenders: string[] = [];
    for (const file of files) {
      // Skip config, tests, and pricing loader.
      if (
        file.rel === 'config/pricing.json' ||
        file.rel === 'lib/pricing/config.ts' ||
        file.rel === 'lib/pricing/availability.ts' ||
        file.rel.endsWith('.test.ts')
      )
        continue;
      // Skip plumbing.
      if (isPlumbing(file.rel)) continue;

      for (const price of allPrices) {
        // Escape dollars for regex.
        const escaped = price.replace('$', '\\$').replace(' ', '\\s?');
        // Match as a standalone price, not part of a word or year.
        // E.g. "$49" but not "2049" or "49th".
        const pattern = new RegExp(`\\b${escaped}\\b`, 'g');
        if (pattern.test(file.text)) {
          offenders.push(`${file.rel}: ${price}`);
        }
      }
    }

    expect(offenders, `Price literals found in:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('PRICING config has expected tiers and amounts', () => {
    expect(PRICING.tiers).toHaveLength(3);
    expect(PRICING.tiers[0].priceCents).toBe(4900);
    expect(PRICING.tiers[1].priceCents).toBe(9900);
    expect(PRICING.tiers[2].priceCents).toBe(14900);
    expect(PRICING.lifetime.priceCents).toBe(44900);
  });
});
