import { describe, it, expect } from 'vitest';
import { buildVariantSet } from '@/pipeline/recipes/matrix';

describe('buildVariantSet', () => {
  const base = { type: 'cards', niche: 'saas', style: 'minimal' };

  it('produces the full columns × icons × iconStyle matrix', () => {
    const out = buildVariantSet(base, [2, 3, 4], ['top', 'left'], ['circle', 'plain', 'number']);
    expect(out).toHaveLength(18); // 3 × 2 × 3
    const keys = new Set(out.map((t) => `${t.variant!.columns}|${t.variant!.icons}|${t.variant!.iconStyle}`));
    expect(keys.size).toBe(18);
    for (const t of out) {
      expect(t.type).toBe('cards');
      expect(t.variant!.group).toBe('cards-saas-minimal');
      expect([2, 3, 4]).toContain(t.variant!.columns);
      expect(['top', 'left']).toContain(t.variant!.icons);
      expect(['circle', 'plain', 'number']).toContain(t.variant!.iconStyle);
      expect(t.layout).toMatch(/column/);
    }
  });

  it('reflects the dimensions in the layout phrase', () => {
    const [t] = buildVariantSet(base, [3], ['top'], ['number']);
    expect(t.layout).toContain('3');
    expect(t.layout?.toLowerCase()).toContain('number');
  });
});
