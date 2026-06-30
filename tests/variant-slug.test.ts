import { describe, it, expect } from 'vitest';
import { variantSlug } from '@/pipeline/run';
import type { Target } from '@/pipeline/recipes';

const cardTarget = (columns: number, icons: string, iconStyle: string): Target =>
  ({ type: 'cards', niche: 'saas', style: 'minimal', variant: { group: 'cards-saas-minimal', columns, icons: icons as 'top' | 'left', iconStyle: iconStyle as 'circle' | 'plain' | 'number' } });

describe('variantSlug', () => {
  it('appends the full variant to card slugs so all 18 combos are unique', () => {
    const base = 'minimal-saas-feature-cards';
    const slugs = new Set<string>();
    for (const c of [2, 3, 4]) for (const ic of ['top', 'left']) for (const st of ['circle', 'plain', 'number']) {
      slugs.add(variantSlug(base, cardTarget(c, ic, st)));
    }
    expect(slugs.size).toBe(18); // no collisions
    expect(slugs.has('minimal-saas-feature-cards-3col-top-circle')).toBe(true);
  });

  it('leaves non-card slugs untouched', () => {
    const t: Target = { type: 'hero', niche: 'saas', style: 'minimal' };
    expect(variantSlug('saas-hero', t)).toBe('saas-hero');
  });
});
